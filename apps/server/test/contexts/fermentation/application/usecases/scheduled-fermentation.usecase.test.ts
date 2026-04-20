import { describe, expect, it, vi } from 'vitest';
import type { EntryRepositoryGateway } from '@/contexts/entry/domain/gateways/entry-repository.gateway.js';
import { Entry } from '@/contexts/entry/domain/models/entry.js';
import { ScheduledFermentationUsecase } from '@/contexts/fermentation/application/usecases/scheduled-fermentation.usecase.js';
import type { FermentationRepositoryGateway } from '@/contexts/fermentation/domain/gateways/fermentation-repository.gateway.js';
import type { LlmAnalysisGateway } from '@/contexts/fermentation/domain/gateways/llm-analysis.gateway.js';
import type { EntryQuestionLinkRepositoryGateway } from '@/contexts/question/domain/gateways/entry-question-link-repository.gateway.js';
import type { QuestionRepositoryGateway } from '@/contexts/question/domain/gateways/question-repository.gateway.js';
import type { QuestionTransactionRepositoryGateway } from '@/contexts/question/domain/gateways/question-transaction-repository.gateway.js';
import { Question } from '@/contexts/question/domain/models/question.js';
import { QuestionTransaction } from '@/contexts/question/domain/models/question-transaction.js';

const generateId = () => 'test-id';

function makeEntry(userId: string, id: string): Entry {
  return Entry.fromProps({
    id,
    userId,
    content: `Entry content for ${id}`,
    mediaUrls: [],
    fermentationEnabled: true,
    createdAt: '2026-04-13T10:00:00.000Z',
    updatedAt: '2026-04-13T10:00:00.000Z',
  });
}

function makeQuestion(userId: string, id: string): Question {
  return Question.fromProps({
    id,
    userId,
    isArchived: false,
    isValidatedByUser: true,
    isProposedByOryzae: false,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  });
}

function makeQuestionTransaction(questionId: string, text: string): QuestionTransaction {
  return QuestionTransaction.fromProps({
    id: 'qt-1',
    questionId,
    string: text,
    questionVersion: 1,
    isValidatedByUser: true,
    isProposedByOryzae: false,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  });
}

function mockEntryRepo(): EntryRepositoryGateway {
  return {
    findById: vi.fn(),
    findByIds: vi.fn(),
    listByUserId: vi.fn(),
    listByUserIdAndDate: vi.fn().mockResolvedValue([]),
    listFermentationEnabledByUserIdAndDate: vi.fn().mockResolvedValue([]),
    listByUserIdAndWeek: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };
}

function mockQuestionRepo(): QuestionRepositoryGateway {
  return {
    findById: vi.fn(),
    listActiveByUserId: vi.fn().mockResolvedValue([]),
    listAllByUserId: vi.fn(),
    listPendingByUserId: vi.fn(),
    countActiveByUserId: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };
}

function mockQuestionTransactionRepo(): QuestionTransactionRepositoryGateway {
  return {
    listByQuestionId: vi.fn(),
    findLatestByQuestionId: vi.fn(),
    findLatestValidatedByQuestionId: vi.fn().mockResolvedValue(null),
    findLatestUnvalidatedByQuestionId: vi.fn(),
    append: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };
}

function mockLinkRepo(): EntryQuestionLinkRepositoryGateway {
  return {
    link: vi.fn(),
    unlink: vi.fn(),
    listQuestionIdsByEntryId: vi.fn(),
    listEntryIdsByQuestionId: vi.fn().mockResolvedValue([]),
  };
}

function mockFermentationRepo(): FermentationRepositoryGateway {
  return {
    save: vi.fn(),
    update: vi.fn(),
    findById: vi.fn(),
    findByIdWithDetails: vi.fn(),
    listByQuestionId: vi.fn(),
    saveScannedEntries: vi.fn(),
    listScannedEntryIds: vi.fn().mockResolvedValue([]),
    saveWorksheet: vi.fn(),
    saveSnippets: vi.fn(),
    saveLetter: vi.fn(),
    saveKeywords: vi.fn(),
  };
}

function mockLlm(): LlmAnalysisGateway {
  return {
    analyze: vi.fn().mockResolvedValue({
      output: {
        worksheetMarkdown: '### Worksheet',
        resultDiagramMarkdown: '### Diagram',
        snippets: [{ type: 'core', text: 'snippet', sourceDate: '4/13', reason: 'reason' }],
        letterBody: 'Dear user...',
        keywords: [{ keyword: 'test', description: 'a keyword' }],
      },
      usage: { inputTokens: 100, outputTokens: 200 },
      generationId: 'gen_test',
    }),
  };
}

describe('ScheduledFermentationUsecase', () => {
  const dateKey = '2026-04-13';

  it('skips users with no fermentation-enabled entries on the target date', async () => {
    const entryRepo = mockEntryRepo();
    const questionRepo = mockQuestionRepo();
    const listActiveUserIds = vi.fn().mockResolvedValue(['user-1', 'user-2']);

    const usecase = new ScheduledFermentationUsecase(
      entryRepo,
      questionRepo,
      mockQuestionTransactionRepo(),
      mockLinkRepo(),
      mockFermentationRepo(),
      mockLlm(),
      generateId,
      listActiveUserIds,
    );

    const result = await usecase.execute(dateKey);

    expect(result.totalUsers).toBe(0);
    expect(result.totalFermentations).toBe(0);
    expect(questionRepo.listActiveByUserId).not.toHaveBeenCalled();
  });

  it('runs fermentation for users with fermentation-enabled entries and active questions', async () => {
    const entry = makeEntry('user-1', 'e1');
    const question = makeQuestion('user-1', 'q1');
    const transaction = makeQuestionTransaction('q1', 'What is love?');

    const entryRepo = mockEntryRepo();
    vi.mocked(entryRepo.listFermentationEnabledByUserIdAndDate).mockResolvedValue([entry]);

    const questionRepo = mockQuestionRepo();
    vi.mocked(questionRepo.listActiveByUserId).mockResolvedValue([question]);

    const qtRepo = mockQuestionTransactionRepo();
    vi.mocked(qtRepo.findLatestValidatedByQuestionId).mockResolvedValue(transaction);

    const linkRepo = mockLinkRepo();
    vi.mocked(linkRepo.listEntryIdsByQuestionId).mockResolvedValue(['e1']);

    const fermentationRepo = mockFermentationRepo();
    const llm = mockLlm();

    const usecase = new ScheduledFermentationUsecase(
      entryRepo,
      questionRepo,
      qtRepo,
      linkRepo,
      fermentationRepo,
      llm,
      generateId,
      vi.fn().mockResolvedValue(['user-1']),
    );

    const result = await usecase.execute(dateKey);

    expect(result.totalUsers).toBe(1);
    expect(result.totalFermentations).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
    expect(llm.analyze).toHaveBeenCalledOnce();
  });

  it('fermentation_enabled=false のエントリしかない場合はスキップする', async () => {
    // Repository's filtered method returns empty array
    const entryRepo = mockEntryRepo();
    vi.mocked(entryRepo.listFermentationEnabledByUserIdAndDate).mockResolvedValue([]);

    const questionRepo = mockQuestionRepo();
    vi.mocked(questionRepo.listActiveByUserId).mockResolvedValue([makeQuestion('user-1', 'q1')]);

    const usecase = new ScheduledFermentationUsecase(
      entryRepo,
      questionRepo,
      mockQuestionTransactionRepo(),
      mockLinkRepo(),
      mockFermentationRepo(),
      mockLlm(),
      generateId,
      vi.fn().mockResolvedValue(['user-1']),
    );

    const result = await usecase.execute(dateKey);

    expect(result.totalUsers).toBe(0);
    expect(questionRepo.listActiveByUserId).not.toHaveBeenCalled();
  });

  it('skips questions without validated transaction text', async () => {
    const entry = makeEntry('user-1', 'e1');
    const question = makeQuestion('user-1', 'q1');

    const entryRepo = mockEntryRepo();
    vi.mocked(entryRepo.listFermentationEnabledByUserIdAndDate).mockResolvedValue([entry]);

    const questionRepo = mockQuestionRepo();
    vi.mocked(questionRepo.listActiveByUserId).mockResolvedValue([question]);

    const qtRepo = mockQuestionTransactionRepo();
    // findLatestValidatedByQuestionId returns null (default mock)

    const linkRepo = mockLinkRepo();
    vi.mocked(linkRepo.listEntryIdsByQuestionId).mockResolvedValue(['e1']);

    const llm = mockLlm();

    const usecase = new ScheduledFermentationUsecase(
      entryRepo,
      questionRepo,
      qtRepo,
      linkRepo,
      mockFermentationRepo(),
      llm,
      generateId,
      vi.fn().mockResolvedValue(['user-1']),
    );

    const result = await usecase.execute(dateKey);

    expect(result.totalUsers).toBe(1);
    expect(result.totalFermentations).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(llm.analyze).not.toHaveBeenCalled();
  });

  it('records errors without stopping other fermentations', async () => {
    const entry = makeEntry('user-1', 'e1');
    const q1 = makeQuestion('user-1', 'q1');
    const q2 = makeQuestion('user-1', 'q2');
    const t1 = makeQuestionTransaction('q1', 'Question 1');
    const t2 = makeQuestionTransaction('q2', 'Question 2');

    const entryRepo = mockEntryRepo();
    vi.mocked(entryRepo.listFermentationEnabledByUserIdAndDate).mockResolvedValue([entry]);

    const questionRepo = mockQuestionRepo();
    vi.mocked(questionRepo.listActiveByUserId).mockResolvedValue([q1, q2]);

    const qtRepo = mockQuestionTransactionRepo();
    vi.mocked(qtRepo.findLatestValidatedByQuestionId).mockImplementation(async (questionId) => {
      if (questionId === 'q1') return t1;
      return t2;
    });

    const linkRepo = mockLinkRepo();
    vi.mocked(linkRepo.listEntryIdsByQuestionId).mockResolvedValue(['e1']);

    const fermentationRepo = mockFermentationRepo();
    // Make save fail on first call (simulating RunFermentationUsecase failure)
    let callCount = 0;
    vi.mocked(fermentationRepo.save).mockImplementation(async () => {
      callCount++;
      if (callCount === 1) throw new Error('DB connection error');
    });

    const llm = mockLlm();

    const usecase = new ScheduledFermentationUsecase(
      entryRepo,
      questionRepo,
      qtRepo,
      linkRepo,
      fermentationRepo,
      llm,
      generateId,
      vi.fn().mockResolvedValue(['user-1']),
    );

    const result = await usecase.execute(dateKey);

    expect(result.totalFermentations).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].questionId).toBe('q1');
  });

  it('returns empty result when no active users exist', async () => {
    const usecase = new ScheduledFermentationUsecase(
      mockEntryRepo(),
      mockQuestionRepo(),
      mockQuestionTransactionRepo(),
      mockLinkRepo(),
      mockFermentationRepo(),
      mockLlm(),
      generateId,
      vi.fn().mockResolvedValue([]),
    );

    const result = await usecase.execute(dateKey);

    expect(result.totalUsers).toBe(0);
    expect(result.totalFermentations).toBe(0);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('combines multiple entries content with separator and records all scanned entry ids', async () => {
    const e1 = makeEntry('user-1', 'e1');
    const e2 = makeEntry('user-1', 'e2');
    const question = makeQuestion('user-1', 'q1');
    const transaction = makeQuestionTransaction('q1', 'My question');

    const entryRepo = mockEntryRepo();
    vi.mocked(entryRepo.listFermentationEnabledByUserIdAndDate).mockResolvedValue([e1, e2]);

    const questionRepo = mockQuestionRepo();
    vi.mocked(questionRepo.listActiveByUserId).mockResolvedValue([question]);

    const qtRepo = mockQuestionTransactionRepo();
    vi.mocked(qtRepo.findLatestValidatedByQuestionId).mockResolvedValue(transaction);

    const linkRepo = mockLinkRepo();
    vi.mocked(linkRepo.listEntryIdsByQuestionId).mockResolvedValue(['e1', 'e2']);

    const llm = mockLlm();
    const fermentationRepo = mockFermentationRepo();

    const usecase = new ScheduledFermentationUsecase(
      entryRepo,
      questionRepo,
      qtRepo,
      linkRepo,
      fermentationRepo,
      llm,
      generateId,
      vi.fn().mockResolvedValue(['user-1']),
    );

    await usecase.execute(dateKey);

    expect(fermentationRepo.save).toHaveBeenCalledOnce();
    // The LLM should receive combined content
    expect(llm.analyze).toHaveBeenCalledWith(
      expect.objectContaining({
        entryContent: expect.stringContaining('---'),
      }),
    );
    // All scanned entry ids should be recorded (not just the first)
    expect(fermentationRepo.saveScannedEntries).toHaveBeenCalledWith('test-id', ['e1', 'e2']);
  });

  it('only includes entries linked to each question (does not leak other-question entries)', async () => {
    const e1 = makeEntry('user-1', 'e1');
    const e2 = makeEntry('user-1', 'e2');
    const q1 = makeQuestion('user-1', 'q1');
    const q2 = makeQuestion('user-1', 'q2');
    const t1 = makeQuestionTransaction('q1', 'Q1');
    const t2 = makeQuestionTransaction('q2', 'Q2');

    const entryRepo = mockEntryRepo();
    vi.mocked(entryRepo.listFermentationEnabledByUserIdAndDate).mockResolvedValue([e1, e2]);

    const questionRepo = mockQuestionRepo();
    vi.mocked(questionRepo.listActiveByUserId).mockResolvedValue([q1, q2]);

    const qtRepo = mockQuestionTransactionRepo();
    vi.mocked(qtRepo.findLatestValidatedByQuestionId).mockImplementation(async (id) =>
      id === 'q1' ? t1 : t2,
    );

    const linkRepo = mockLinkRepo();
    vi.mocked(linkRepo.listEntryIdsByQuestionId).mockImplementation(async (id) =>
      id === 'q1' ? ['e1'] : ['e2'],
    );

    const llm = mockLlm();

    const usecase = new ScheduledFermentationUsecase(
      entryRepo,
      questionRepo,
      qtRepo,
      linkRepo,
      mockFermentationRepo(),
      llm,
      generateId,
      vi.fn().mockResolvedValue(['user-1']),
    );

    const result = await usecase.execute(dateKey);

    expect(result.totalFermentations).toBe(2);
    expect(result.succeeded).toBe(2);
    expect(llm.analyze).toHaveBeenCalledTimes(2);
    expect(llm.analyze).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ question: 'Q1', entryContent: 'Entry content for e1' }),
    );
    expect(llm.analyze).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ question: 'Q2', entryContent: 'Entry content for e2' }),
    );
  });

  it('skips a question when no entries of the day are linked to it', async () => {
    const entry = makeEntry('user-1', 'e1');
    const question = makeQuestion('user-1', 'q1');
    const transaction = makeQuestionTransaction('q1', 'Q');

    const entryRepo = mockEntryRepo();
    vi.mocked(entryRepo.listFermentationEnabledByUserIdAndDate).mockResolvedValue([entry]);

    const questionRepo = mockQuestionRepo();
    vi.mocked(questionRepo.listActiveByUserId).mockResolvedValue([question]);

    const qtRepo = mockQuestionTransactionRepo();
    vi.mocked(qtRepo.findLatestValidatedByQuestionId).mockResolvedValue(transaction);

    const linkRepo = mockLinkRepo();
    // Question is linked to a different entry not written today
    vi.mocked(linkRepo.listEntryIdsByQuestionId).mockResolvedValue(['other-entry']);

    const llm = mockLlm();

    const usecase = new ScheduledFermentationUsecase(
      entryRepo,
      questionRepo,
      qtRepo,
      linkRepo,
      mockFermentationRepo(),
      llm,
      generateId,
      vi.fn().mockResolvedValue(['user-1']),
    );

    const result = await usecase.execute(dateKey);

    expect(result.totalUsers).toBe(1);
    expect(result.totalFermentations).toBe(0);
    expect(llm.analyze).not.toHaveBeenCalled();
  });
});
