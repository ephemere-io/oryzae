import { describe, expect, it, vi } from 'vitest';
import { RunFermentationUsecase } from '@/contexts/fermentation/application/usecases/run-fermentation.usecase.js';
import type { FermentationRepositoryGateway } from '@/contexts/fermentation/domain/gateways/fermentation-repository.gateway.js';
import type { LlmAnalysisGateway } from '@/contexts/fermentation/domain/gateways/llm-analysis.gateway.js';
import { FermentationResult } from '@/contexts/fermentation/domain/models/fermentation-result.js';
import type { AiUsageRecorder } from '@/contexts/shared/domain/gateways/ai-usage-recorder.gateway.js';

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
    errorMessage: 'previous LLM timeout',
    createdAt: overrides.createdAt ?? '2026-06-25T03:05:00.000Z',
    updatedAt: '2026-06-25T03:05:00.000Z',
  });
}

function mockUsage(): AiUsageRecorder {
  return { record: vi.fn().mockResolvedValue(undefined) };
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
    }),
  };
}

describe('RunFermentationUsecase', () => {
  it('creates fermentation result and saves all outputs', async () => {
    const repo = mockRepo();
    const llm = mockLlm();
    const usecase = new RunFermentationUsecase(repo, llm, mockUsage(), generateId);

    const result = await usecase.execute({
      userId: 'u1',
      questionId: 'q1',
      questionText: 'What is love?',
      entries: [{ id: 'e1', content: 'Today I thought about love.' }],
    });

    expect(result.id).toBe('test-id');
    expect(repo.save).toHaveBeenCalledOnce();
    expect(repo.saveScannedEntries).toHaveBeenCalledWith('test-id', ['e1']);
    expect(repo.update).toHaveBeenCalledTimes(2); // processing + completed
    expect(llm.analyze).toHaveBeenCalledOnce();
    expect(repo.saveWorksheet).toHaveBeenCalledOnce();
    expect(repo.saveSnippets).toHaveBeenCalledOnce();
    expect(repo.saveLetter).toHaveBeenCalledOnce();
    expect(repo.saveKeywords).toHaveBeenCalledOnce();
  });

  it('defaults language to "ja" when not specified (issue #279)', async () => {
    const repo = mockRepo();
    const llm = mockLlm();
    const usecase = new RunFermentationUsecase(repo, llm, mockUsage(), generateId);

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
    const usecase = new RunFermentationUsecase(repo, llm, mockUsage(), generateId);

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
    const usecase = new RunFermentationUsecase(repo, llm, mockUsage(), generateId);

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
    const usecase = new RunFermentationUsecase(repo, mockLlm(), mockUsage(), generateId);

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
    const usecase = new RunFermentationUsecase(repo, llm, mockUsage(), generateId);

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

  describe('AI の利用記録（ai_usage）', () => {
    it('AI を呼んだら、誰が・どの発酵で・何トークン使ったかを記録する', async () => {
      const usage = mockUsage();
      const usecase = new RunFermentationUsecase(mockRepo(), mockLlm(), usage, generateId);

      await usecase.execute({
        userId: 'u1',
        questionId: 'q1',
        questionText: 'test',
        entries: [{ id: 'e1', content: 'test' }],
      });

      expect(usage.record).toHaveBeenCalledWith({
        userId: 'u1',
        feature: 'fermentation',
        refId: 'test-id',
        inputTokens: 100,
        outputTokens: 200,
      });
    });

    // AI が応答した時点で課金は済んでいる。その後の保存が落ちても記録は残す。
    it('AI の後の保存が落ちても、記録は残っている', async () => {
      const repo = mockRepo();
      repo.saveWorksheet = vi.fn().mockRejectedValue(new Error('db write failed'));
      const usage = mockUsage();
      const usecase = new RunFermentationUsecase(repo, mockLlm(), usage, generateId);

      await expect(
        usecase.execute({
          userId: 'u1',
          questionId: 'q1',
          questionText: 'test',
          entries: [{ id: 'e1', content: 'test' }],
        }),
      ).rejects.toThrow('db write failed');

      expect(usage.record).toHaveBeenCalledOnce();
    });

    it('AI 自体が失敗したら記録しない（応答が無くトークン数が分からない）', async () => {
      const usage = mockUsage();
      const llm: LlmAnalysisGateway = {
        analyze: vi.fn().mockRejectedValue(new Error('LLM timeout')),
      };
      const usecase = new RunFermentationUsecase(mockRepo(), llm, usage, generateId);

      await expect(
        usecase.execute({
          userId: 'u1',
          questionId: 'q1',
          questionText: 'test',
          entries: [{ id: 'e1', content: 'test' }],
        }),
      ).rejects.toThrow('LLM analysis failed');

      expect(usage.record).not.toHaveBeenCalled();
    });

    it('再試行は既存の発酵の id で、1 回ぶんとして記録する', async () => {
      const usage = mockUsage();
      const usecase = new RunFermentationUsecase(mockRepo(), mockLlm(), usage, generateId);

      await usecase.execute({
        userId: 'u1',
        questionId: 'q1',
        questionText: 'Q',
        entries: [{ id: 'e1', content: 'test' }],
        retryOf: makeFailedResult({ id: 'f1' }),
      });

      expect(usage.record).toHaveBeenCalledWith(expect.objectContaining({ refId: 'f1' }));
    });

    // 記録はレポートのため。記録の表が無い・DB が一時的に落ちている、で発酵を失敗させない。
    it('記録に失敗しても、発酵は完了する', async () => {
      const repo = mockRepo();
      const usage: AiUsageRecorder = {
        record: vi.fn().mockRejectedValue(new Error('relation does not exist')),
      };
      const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
      const usecase = new RunFermentationUsecase(repo, mockLlm(), usage, generateId);

      await usecase.execute({
        userId: 'u1',
        questionId: 'q1',
        questionText: 'test',
        entries: [{ id: 'e1', content: 'test' }],
      });

      const statuses = vi.mocked(repo.update).mock.calls.map(([r]) => r.status);
      expect(statuses).toContain('completed');
      errorLog.mockRestore();
    });
  });

  // issue #353: retryOf を渡すと既存行を再利用して再実行する。
  describe('retry mode (issue #353)', () => {
    it('reuses the existing row instead of creating a new one', async () => {
      const repo = mockRepo();
      const llm = mockLlm();
      const usecase = new RunFermentationUsecase(repo, llm, mockUsage(), generateId);
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
      const usecase = new RunFermentationUsecase(repo, mockLlm(), mockUsage(), generateId);

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
      const usecase = new RunFermentationUsecase(repo, llm, mockUsage(), generateId);

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
      const usecase = new RunFermentationUsecase(repo, mockLlm(), mockUsage(), generateId);

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
      const usecase = new RunFermentationUsecase(repo, mockLlm(), mockUsage(), generateId);

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
