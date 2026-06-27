import { describe, expect, it, vi } from 'vitest';
import type { EntryRepositoryGateway } from '@/contexts/entry/domain/gateways/entry-repository.gateway.js';
import { Entry } from '@/contexts/entry/domain/models/entry.js';
import { RetryFailedFermentationsUsecase } from '@/contexts/fermentation/application/usecases/retry-failed-fermentations.usecase.js';
import type { FermentationRepositoryGateway } from '@/contexts/fermentation/domain/gateways/fermentation-repository.gateway.js';
import type { LlmAnalysisGateway } from '@/contexts/fermentation/domain/gateways/llm-analysis.gateway.js';
import type { UserLocaleResolverGateway } from '@/contexts/fermentation/domain/gateways/user-locale-resolver.gateway.js';
import { FermentationResult } from '@/contexts/fermentation/domain/models/fermentation-result.js';
import type { QuestionTransactionRepositoryGateway } from '@/contexts/question/domain/gateways/question-transaction-repository.gateway.js';
import { QuestionTransaction } from '@/contexts/question/domain/models/question-transaction.js';

const generateId = () => 'gen-id';
const NOW = new Date('2026-06-27T03:00:00.000Z');

function makeFailed(
  id: string,
  userId: string,
  questionId: string,
  createdAt = '2026-06-26T03:05:00.000Z',
): FermentationResult {
  return FermentationResult.fromProps({
    id,
    userId,
    questionId,
    targetPeriod: '2026-06-26',
    status: 'failed',
    generationId: null,
    inputTokens: null,
    outputTokens: null,
    errorMessage: 'previous failure',
    createdAt,
    updatedAt: createdAt,
  });
}

function makeEntry(userId: string, id: string): Entry {
  return Entry.fromProps({
    id,
    userId,
    content: `content ${id}`,
    mediaUrls: [],
    fermentationEnabled: true,
    createdAt: '2026-06-20T10:00:00.000Z',
    updatedAt: '2026-06-20T10:00:00.000Z',
  });
}

function makeTransaction(questionId: string, text: string): QuestionTransaction {
  return QuestionTransaction.fromProps({
    id: `qt-${questionId}`,
    questionId,
    string: text,
    questionVersion: 1,
    isValidatedByUser: true,
    isProposedByOryzae: false,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  });
}

function mockFermentationRepo(): FermentationRepositoryGateway {
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
    updateKeywordJarPositions: vi.fn(),
    updateSnippetJarPositions: vi.fn(),
    updateLetterJarPositions: vi.fn(),
  };
}

function mockEntryRepo(): EntryRepositoryGateway {
  return {
    findById: vi.fn(),
    findByIds: vi.fn().mockResolvedValue([]),
    listByUserId: vi.fn(),
    listByUserIdAndDate: vi.fn(),
    listFermentationEnabledByUserIdAndDate: vi.fn(),
    listFermentationEnabledByUserIdSince: vi.fn(),
    countCharsByUserIdSince: vi.fn(),
    listByUserIdAndWeek: vi.fn(),
    searchByUserId: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };
}

function mockQuestionTransactionRepo(): QuestionTransactionRepositoryGateway {
  return {
    listByQuestionId: vi.fn(),
    findLatestByQuestionId: vi.fn(),
    findLatestValidatedByQuestionId: vi.fn().mockResolvedValue(null),
    findLatestValidatedByQuestionIds: vi.fn(),
    findLatestUnvalidatedByQuestionId: vi.fn(),
    append: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };
}

function mockLocaleResolver(): UserLocaleResolverGateway {
  return { resolve: vi.fn().mockResolvedValue('ja') };
}

function mockLlm(): LlmAnalysisGateway {
  return {
    analyze: vi.fn().mockResolvedValue({
      output: {
        worksheetMarkdown: '### W',
        resultDiagramMarkdown: '### D',
        snippets: [{ type: 'core', text: 't', sourceDate: '6/26', reason: 'r' }],
        letterBody: 'Dear...',
        keywords: [{ keyword: 'k', description: 'd' }],
      },
      usage: { inputTokens: 10, outputTokens: 20 },
      generationId: 'gen_x',
    }),
  };
}

interface Deps {
  fermentationRepo: FermentationRepositoryGateway;
  entryRepo: EntryRepositoryGateway;
  qtRepo: QuestionTransactionRepositoryGateway;
  localeResolver: UserLocaleResolverGateway;
  llm: LlmAnalysisGateway;
  sendDigest: ReturnType<typeof vi.fn>;
}

function makeDeps(): Deps {
  return {
    fermentationRepo: mockFermentationRepo(),
    entryRepo: mockEntryRepo(),
    qtRepo: mockQuestionTransactionRepo(),
    localeResolver: mockLocaleResolver(),
    llm: mockLlm(),
    sendDigest: vi.fn().mockResolvedValue(undefined),
  };
}

function makeUsecase(d: Deps, opts: { concurrency?: number; maxRetries?: number } = {}) {
  return new RetryFailedFermentationsUsecase(
    d.fermentationRepo,
    d.entryRepo,
    d.qtRepo,
    d.localeResolver,
    d.llm,
    generateId,
    d.sendDigest,
    opts.concurrency ?? 1,
    opts.maxRetries,
  );
}

describe('RetryFailedFermentationsUsecase (issue #353)', () => {
  it('returns an empty result and does nothing when there is nothing retryable', async () => {
    const d = makeDeps();
    const result = await makeUsecase(d).execute(NOW);

    expect(result.totalCandidates).toBe(0);
    expect(result.attempted).toBe(0);
    expect(d.llm.analyze).not.toHaveBeenCalled();
    expect(d.sendDigest).not.toHaveBeenCalled();
  });

  it('queries listRetryable with a [now - 30h, now) window', async () => {
    const d = makeDeps();
    await makeUsecase(d).execute(NOW);

    expect(d.fermentationRepo.listRetryable).toHaveBeenCalledWith(
      '2026-06-25T21:00:00.000Z', // now - 30h
      '2026-06-27T03:00:00.000Z', // now (今 run の新規行を除外する上限)
    );
  });

  it('reuses the row, clears outputs, and sends one digest on success', async () => {
    const d = makeDeps();
    vi.mocked(d.fermentationRepo.listRetryable).mockResolvedValue([makeFailed('f1', 'u1', 'q1')]);
    vi.mocked(d.qtRepo.findLatestValidatedByQuestionId).mockResolvedValue(
      makeTransaction('q1', 'Why do I write?'),
    );
    vi.mocked(d.fermentationRepo.listScannedEntryIds).mockResolvedValue(['e1']);
    vi.mocked(d.entryRepo.findByIds).mockResolvedValue([makeEntry('u1', 'e1')]);

    const result = await makeUsecase(d).execute(NOW);

    expect(result.attempted).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
    // 既存行を再利用するので save(新規) は呼ばれず、clearOutputs が呼ばれる。
    expect(d.fermentationRepo.save).not.toHaveBeenCalled();
    expect(d.fermentationRepo.clearOutputs).toHaveBeenCalledWith('f1');
    // 成功したユーザーへ digest を1通送る。
    expect(d.sendDigest).toHaveBeenCalledOnce();
    expect(d.sendDigest).toHaveBeenCalledWith('u1', ['Why do I write?'], 'ja');
  });

  it('skips a result whose question can no longer be resolved', async () => {
    const d = makeDeps();
    vi.mocked(d.fermentationRepo.listRetryable).mockResolvedValue([makeFailed('f1', 'u1', 'q1')]);
    vi.mocked(d.qtRepo.findLatestValidatedByQuestionId).mockResolvedValue(null);

    const result = await makeUsecase(d).execute(NOW);

    expect(result.skipped).toBe(1);
    expect(result.attempted).toBe(0);
    expect(d.llm.analyze).not.toHaveBeenCalled();
    expect(d.sendDigest).not.toHaveBeenCalled();
  });

  it('skips a result whose scanned entries no longer exist', async () => {
    const d = makeDeps();
    vi.mocked(d.fermentationRepo.listRetryable).mockResolvedValue([makeFailed('f1', 'u1', 'q1')]);
    vi.mocked(d.qtRepo.findLatestValidatedByQuestionId).mockResolvedValue(
      makeTransaction('q1', 'Q'),
    );
    vi.mocked(d.fermentationRepo.listScannedEntryIds).mockResolvedValue(['e1']);
    vi.mocked(d.entryRepo.findByIds).mockResolvedValue([]); // entries deleted

    const result = await makeUsecase(d).execute(NOW);

    expect(result.skipped).toBe(1);
    expect(result.attempted).toBe(0);
    expect(d.llm.analyze).not.toHaveBeenCalled();
  });

  it('counts a failed retry and does not send a digest for it', async () => {
    const d = makeDeps();
    vi.mocked(d.fermentationRepo.listRetryable).mockResolvedValue([makeFailed('f1', 'u1', 'q1')]);
    vi.mocked(d.qtRepo.findLatestValidatedByQuestionId).mockResolvedValue(
      makeTransaction('q1', 'Q'),
    );
    vi.mocked(d.fermentationRepo.listScannedEntryIds).mockResolvedValue(['e1']);
    vi.mocked(d.entryRepo.findByIds).mockResolvedValue([makeEntry('u1', 'e1')]);
    vi.mocked(d.llm.analyze).mockRejectedValue(new Error('LLM still down'));

    const result = await makeUsecase(d).execute(NOW);

    expect(result.attempted).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(result.errors).toEqual([
      { userId: 'u1', fermentationResultId: 'f1', error: 'LLM analysis failed: LLM still down' },
    ]);
    // 再実行を試みた証跡（行再利用）。
    expect(d.fermentationRepo.clearOutputs).toHaveBeenCalledWith('f1');
    expect(d.sendDigest).not.toHaveBeenCalled();
  });

  it('batches multiple successes for the same user into one digest', async () => {
    const d = makeDeps();
    vi.mocked(d.fermentationRepo.listRetryable).mockResolvedValue([
      makeFailed('f1', 'u1', 'q1', '2026-06-26T03:05:00.000Z'),
      makeFailed('f2', 'u1', 'q2', '2026-06-26T03:06:00.000Z'),
    ]);
    vi.mocked(d.qtRepo.findLatestValidatedByQuestionId).mockImplementation(async (qid: string) =>
      makeTransaction(qid, `Q for ${qid}`),
    );
    vi.mocked(d.fermentationRepo.listScannedEntryIds).mockResolvedValue(['e1']);
    vi.mocked(d.entryRepo.findByIds).mockResolvedValue([makeEntry('u1', 'e1')]);

    const result = await makeUsecase(d).execute(NOW);

    expect(result.succeeded).toBe(2);
    expect(d.sendDigest).toHaveBeenCalledOnce();
    expect(d.sendDigest).toHaveBeenCalledWith('u1', ['Q for q1', 'Q for q2'], 'ja');
  });

  it('truncates to the cap (oldest first) and logs the dropped count', async () => {
    const d = makeDeps();
    // created_at 昇順で 3 件。cap=2 なので古い f1,f2 を処理し f3 を落とす。
    vi.mocked(d.fermentationRepo.listRetryable).mockResolvedValue([
      makeFailed('f1', 'u1', 'q1', '2026-06-26T03:01:00.000Z'),
      makeFailed('f2', 'u2', 'q2', '2026-06-26T03:02:00.000Z'),
      makeFailed('f3', 'u3', 'q3', '2026-06-26T03:03:00.000Z'),
    ]);
    vi.mocked(d.qtRepo.findLatestValidatedByQuestionId).mockImplementation(async (qid: string) =>
      makeTransaction(qid, `Q ${qid}`),
    );
    vi.mocked(d.fermentationRepo.listScannedEntryIds).mockResolvedValue(['e1']);
    vi.mocked(d.entryRepo.findByIds).mockImplementation(async () => [makeEntry('u1', 'e1')]);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await makeUsecase(d, { maxRetries: 2 }).execute(NOW);

    expect(result.totalCandidates).toBe(3);
    expect(result.truncated).toBe(1);
    expect(result.attempted).toBe(2);
    expect(result.succeeded).toBe(2);
    // f3 (q3) は処理されない。
    expect(d.qtRepo.findLatestValidatedByQuestionId).not.toHaveBeenCalledWith('q3');
    expect(warnSpy).toHaveBeenCalledWith(
      '[RetryFailedFermentationsUsecase] truncated retry batch',
      expect.objectContaining({ total: 3, cap: 2, dropped: 1 }),
    );
    warnSpy.mockRestore();
  });

  it('records an email failure without throwing when digest send fails', async () => {
    const d = makeDeps();
    vi.mocked(d.fermentationRepo.listRetryable).mockResolvedValue([makeFailed('f1', 'u1', 'q1')]);
    vi.mocked(d.qtRepo.findLatestValidatedByQuestionId).mockResolvedValue(
      makeTransaction('q1', 'Q'),
    );
    vi.mocked(d.fermentationRepo.listScannedEntryIds).mockResolvedValue(['e1']);
    vi.mocked(d.entryRepo.findByIds).mockResolvedValue([makeEntry('u1', 'e1')]);
    d.sendDigest.mockRejectedValue(new Error('resend 500'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await makeUsecase(d).execute(NOW);

    expect(result.succeeded).toBe(1);
    expect(result.emailFailures).toEqual([{ userId: 'u1', error: 'resend 500' }]);
    errSpy.mockRestore();
  });
});
