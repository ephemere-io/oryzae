import { describe, expect, it, vi } from 'vitest';
import { RunFermentationUsecase } from '@/contexts/fermentation/application/usecases/run-fermentation.usecase.js';
import type { FermentationRepositoryGateway } from '@/contexts/fermentation/domain/gateways/fermentation-repository.gateway.js';
import type { LlmAnalysisGateway } from '@/contexts/fermentation/domain/gateways/llm-analysis.gateway.js';
import { FermentationResult } from '@/contexts/fermentation/domain/models/fermentation-result.js';

const generateId = () => 'test-id';

function mockRepo(): FermentationRepositoryGateway {
  return {
    save: vi.fn(),
    update: vi.fn(),
    findById: vi.fn(),
    findByIdWithDetails: vi.fn(),
    listByQuestionId: vi.fn(),
    listRetryable: vi.fn().mockResolvedValue([]),
    clearOutputs: vi.fn(),
    saveScannedEntries: vi.fn(),
    listScannedEntryIds: vi.fn().mockResolvedValue([]),
    saveWorksheet: vi.fn(),
    saveSnippets: vi.fn(),
    saveLetter: vi.fn(),
    saveKeywords: vi.fn(),
  };
}

// issue #353: リトライ対象の既存「失敗」行。
function makeFailedResult(
  overrides: Partial<{
    id: string;
    userId: string;
    questionId: string;
    targetPeriod: string;
    createdAt: string;
  }> = {},
): FermentationResult {
  return FermentationResult.fromProps({
    id: overrides.id ?? 'existing-id',
    userId: overrides.userId ?? 'u1',
    questionId: overrides.questionId ?? 'q1',
    targetPeriod: overrides.targetPeriod ?? '2026-06-25',
    status: 'failed',
    generationId: null,
    inputTokens: null,
    outputTokens: null,
    errorMessage: 'previous LLM timeout',
    createdAt: overrides.createdAt ?? '2026-06-25T03:05:00.000Z',
    updatedAt: '2026-06-25T03:05:00.000Z',
  });
}

function mockLlm(): LlmAnalysisGateway {
  return {
    analyze: vi.fn().mockResolvedValue({
      output: {
        worksheetMarkdown: '### Worksheet',
        resultDiagramMarkdown: '### Diagram',
        snippets: [{ type: 'core', text: 'test text', sourceDate: '12/1', reason: 'test reason' }],
        letterBody: 'Dear user...',
        keywords: [{ keyword: 'test', description: 'a test keyword' }],
      },
      usage: { inputTokens: 100, outputTokens: 200 },
      generationId: 'gen_test123',
    }),
  };
}

describe('RunFermentationUsecase', () => {
  it('creates fermentation result and saves all outputs', async () => {
    const repo = mockRepo();
    const llm = mockLlm();
    const usecase = new RunFermentationUsecase(repo, llm, generateId);

    const result = await usecase.execute({
      userId: 'u1',
      questionId: 'q1',
      questionText: 'What is love?',
      entries: [{ id: 'e1', content: 'Today I thought about love.' }],
    });

    expect(result.id).toBe('test-id');
    expect(repo.save).toHaveBeenCalledOnce();
    expect(repo.saveScannedEntries).toHaveBeenCalledWith('test-id', ['e1']);
    expect(repo.update).toHaveBeenCalledTimes(3); // processing + generationId + completed
    expect(llm.analyze).toHaveBeenCalledOnce();
    expect(repo.saveWorksheet).toHaveBeenCalledOnce();
    expect(repo.saveSnippets).toHaveBeenCalledOnce();
    expect(repo.saveLetter).toHaveBeenCalledOnce();
    expect(repo.saveKeywords).toHaveBeenCalledOnce();
  });

  it('defaults language to "ja" when not specified (issue #279)', async () => {
    const repo = mockRepo();
    const llm = mockLlm();
    const usecase = new RunFermentationUsecase(repo, llm, generateId);

    await usecase.execute({
      userId: 'u1',
      questionId: 'q1',
      questionText: 'Q',
      entries: [{ id: 'e1', content: 'c' }],
    });

    expect(llm.analyze).toHaveBeenCalledWith(expect.objectContaining({ language: 'ja' }));
  });

  it('forwards language="en" to the LLM gateway (issue #279)', async () => {
    const repo = mockRepo();
    const llm = mockLlm();
    const usecase = new RunFermentationUsecase(repo, llm, generateId);

    await usecase.execute({
      userId: 'u1',
      questionId: 'q1',
      questionText: 'Q',
      entries: [{ id: 'e1', content: 'c' }],
      language: 'en',
    });

    expect(llm.analyze).toHaveBeenCalledWith(expect.objectContaining({ language: 'en' }));
  });

  it('saves all scanned entry ids when multiple entries are provided', async () => {
    const repo = mockRepo();
    const llm = mockLlm();
    const usecase = new RunFermentationUsecase(repo, llm, generateId);

    await usecase.execute({
      userId: 'u1',
      questionId: 'q1',
      questionText: 'Q',
      entries: [
        { id: 'e1', content: 'content 1' },
        { id: 'e2', content: 'content 2' },
      ],
    });

    expect(repo.saveScannedEntries).toHaveBeenCalledWith('test-id', ['e1', 'e2']);
    expect(llm.analyze).toHaveBeenCalledWith(
      expect.objectContaining({
        entryContent: 'content 1\n\n---\n\ncontent 2',
      }),
    );
  });

  it('rejects execution when no entries are provided', async () => {
    const repo = mockRepo();
    const usecase = new RunFermentationUsecase(repo, mockLlm(), generateId);

    await expect(
      usecase.execute({ userId: 'u1', questionId: 'q1', questionText: 'Q', entries: [] }),
    ).rejects.toThrow('LLM analysis failed');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('marks result as failed when LLM throws', async () => {
    const repo = mockRepo();
    const llm: LlmAnalysisGateway = {
      analyze: vi.fn().mockRejectedValue(new Error('LLM timeout')),
    };
    const usecase = new RunFermentationUsecase(repo, llm, generateId);

    await expect(
      usecase.execute({
        userId: 'u1',
        questionId: 'q1',
        questionText: 'test',
        entries: [{ id: 'e1', content: 'test' }],
      }),
    ).rejects.toThrow('LLM analysis failed');

    // save (pending) + update (processing) + update (failed)
    expect(repo.update).toHaveBeenCalledTimes(2);
    // scanned entries are recorded before LLM runs, so they persist on failure
    expect(repo.saveScannedEntries).toHaveBeenCalledWith('test-id', ['e1']);
  });

  // コスト集計の正確性: LLM が成功した時点で課金は発生しているので、その後の保存処理が
  // 落ちてもトークンは残さなければならない。旧実装は catch 側で usage 未設定の元
  // インスタンスから update していたため、input_tokens/output_tokens を NULL で
  // 上書きし、失敗した発酵のコストがレポートから丸ごと消えていた。
  it('keeps the token usage when a post-LLM step fails', async () => {
    const repo = mockRepo();
    repo.saveWorksheet = vi.fn().mockRejectedValue(new Error('db write failed'));
    const llm = mockLlm();
    const usecase = new RunFermentationUsecase(repo, llm, generateId);

    await expect(
      usecase.execute({
        userId: 'u1',
        questionId: 'q1',
        questionText: 'test',
        entries: [{ id: 'e1', content: 'test' }],
      }),
    ).rejects.toThrow('db write failed');

    const failedUpdate = vi
      .mocked(repo.update)
      .mock.calls.map(([result]) => result.toProps())
      .find((props) => props.status === 'failed');

    expect(failedUpdate).toBeDefined();
    expect(failedUpdate?.inputTokens).toBe(100);
    expect(failedUpdate?.outputTokens).toBe(200);
    expect(failedUpdate?.errorMessage).toBe('db write failed');
  });

  it('leaves tokens null when the LLM itself fails (nothing was billed)', async () => {
    const repo = mockRepo();
    const llm: LlmAnalysisGateway = {
      analyze: vi.fn().mockRejectedValue(new Error('LLM timeout')),
    };
    const usecase = new RunFermentationUsecase(repo, llm, generateId);

    await expect(
      usecase.execute({
        userId: 'u1',
        questionId: 'q1',
        questionText: 'test',
        entries: [{ id: 'e1', content: 'test' }],
      }),
    ).rejects.toThrow('LLM analysis failed');

    const failedUpdate = vi
      .mocked(repo.update)
      .mock.calls.map(([result]) => result.toProps())
      .find((props) => props.status === 'failed');

    expect(failedUpdate?.inputTokens).toBeNull();
    expect(failedUpdate?.outputTokens).toBeNull();
  });

  // issue #353: retryOf を渡すと既存行を再利用して再実行する。
  describe('retry mode (issue #353)', () => {
    it('reuses the existing row instead of creating a new one', async () => {
      const repo = mockRepo();
      const llm = mockLlm();
      const usecase = new RunFermentationUsecase(repo, llm, generateId);
      const retryOf = makeFailedResult({ id: 'f1' });

      const result = await usecase.execute({
        userId: 'u1',
        questionId: 'q1',
        questionText: 'Q',
        entries: [{ id: 'e1', content: 'c' }],
        retryOf,
      });

      // 既存行の id を返し、新規 create/save はしない。
      expect(result.id).toBe('f1');
      expect(repo.save).not.toHaveBeenCalled();
      // 過去試行の部分出力を消してから再実行する。
      expect(repo.clearOutputs).toHaveBeenCalledWith('f1');
    });

    it('clears partial outputs before writing new ones', async () => {
      const repo = mockRepo();
      const usecase = new RunFermentationUsecase(repo, mockLlm(), generateId);

      await usecase.execute({
        userId: 'u1',
        questionId: 'q1',
        questionText: 'Q',
        entries: [{ id: 'e1', content: 'c' }],
        retryOf: makeFailedResult({ id: 'f1' }),
      });

      const clearOrder = vi.mocked(repo.clearOutputs).mock.invocationCallOrder[0];
      const worksheetOrder = vi.mocked(repo.saveWorksheet).mock.invocationCallOrder[0];
      expect(clearOrder).toBeLessThan(worksheetOrder);
    });

    it('uses the original targetPeriod (not today) when retrying', async () => {
      const repo = mockRepo();
      const llm = mockLlm();
      const usecase = new RunFermentationUsecase(repo, llm, generateId);

      await usecase.execute({
        userId: 'u1',
        questionId: 'q1',
        questionText: 'Q',
        entries: [{ id: 'e1', content: 'c' }],
        retryOf: makeFailedResult({ id: 'f1', targetPeriod: '2026-06-25' }),
      });

      expect(llm.analyze).toHaveBeenCalledWith(
        expect.objectContaining({ targetPeriod: '2026-06-25' }),
      );
    });

    it('persists the row with errorMessage cleared and id preserved on success', async () => {
      const repo = mockRepo();
      const usecase = new RunFermentationUsecase(repo, mockLlm(), generateId);

      await usecase.execute({
        userId: 'u1',
        questionId: 'q1',
        questionText: 'Q',
        entries: [{ id: 'e1', content: 'c' }],
        retryOf: makeFailedResult({ id: 'f1' }),
      });

      // 最初の update は processing 化。errorMessage は null にクリアされ id は不変。
      const firstUpdateArg = vi.mocked(repo.update).mock.calls[0][0];
      expect(firstUpdateArg.id).toBe('f1');
      expect(firstUpdateArg.status).toBe('processing');
      expect(firstUpdateArg.errorMessage).toBeNull();
    });

    it('does not call clearOutputs on a normal (non-retry) run', async () => {
      const repo = mockRepo();
      const usecase = new RunFermentationUsecase(repo, mockLlm(), generateId);

      await usecase.execute({
        userId: 'u1',
        questionId: 'q1',
        questionText: 'Q',
        entries: [{ id: 'e1', content: 'c' }],
      });

      expect(repo.clearOutputs).not.toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalledOnce();
    });
  });
});
