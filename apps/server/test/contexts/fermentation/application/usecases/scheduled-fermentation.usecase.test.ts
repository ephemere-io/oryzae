import { describe, expect, it, vi } from 'vitest';
import type { EntryRepositoryGateway } from '@/contexts/entry/domain/gateways/entry-repository.gateway.js';
import { Entry } from '@/contexts/entry/domain/models/entry.js';
import { ScheduledFermentationUsecase } from '@/contexts/fermentation/application/usecases/scheduled-fermentation.usecase.js';
import type { FermentationRepositoryGateway } from '@/contexts/fermentation/domain/gateways/fermentation-repository.gateway.js';
import type { LlmAnalysisGateway } from '@/contexts/fermentation/domain/gateways/llm-analysis.gateway.js';
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

function mockFermentationRepo(): FermentationRepositoryGateway {
  return {
    save: vi.fn(),
    update: vi.fn(),
    findById: vi.fn(),
    findByIdWithDetails: vi.fn(),
    listByQuestionId: vi.fn(),
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

  it('skips users with no entries on the target date', async () => {
    const entryRepo = mockEntryRepo();
    const questionRepo = mockQuestionRepo();
    const listActiveUserIds = vi.fn().mockResolvedValue(['user-1', 'user-2']);

    const usecase = new ScheduledFermentationUsecase(
      entryRepo,
      questionRepo,
      mockQuestionTransactionRepo(),
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

  it('runs fermentation for users with entries and active questions', async () => {
    const entry = makeEntry('user-1', 'e1');
    const question = makeQuestion('user-1', 'q1');
    const transaction = makeQuestionTransaction('q1', 'What is love?');

    const entryRepo = mockEntryRepo();
    vi.mocked(entryRepo.listByUserIdAndDate).mockResolvedValue([entry]);

    const questionRepo = mockQuestionRepo();
    vi.mocked(questionRepo.listActiveByUserId).mockResolvedValue([question]);

    const qtRepo = mockQuestionTransactionRepo();
    vi.mocked(qtRepo.findLatestValidatedByQuestionId).mockResolvedValue(transaction);

    const fermentationRepo = mockFermentationRepo();
    const llm = mockLlm();

    const usecase = new ScheduledFermentationUsecase(
      entryRepo,
      questionRepo,
      qtRepo,
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

  it('skips questions without validated transaction text', async () => {
    const entry = makeEntry('user-1', 'e1');
    const question = makeQuestion('user-1', 'q1');

    const entryRepo = mockEntryRepo();
    vi.mocked(entryRepo.listByUserIdAndDate).mockResolvedValue([entry]);

    const questionRepo = mockQuestionRepo();
    vi.mocked(questionRepo.listActiveByUserId).mockResolvedValue([question]);

    const qtRepo = mockQuestionTransactionRepo();
    // findLatestValidatedByQuestionId returns null (default mock)

    const llm = mockLlm();

    const usecase = new ScheduledFermentationUsecase(
      entryRepo,
      questionRepo,
      qtRepo,
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
    vi.mocked(entryRepo.listByUserIdAndDate).mockResolvedValue([entry]);

    const questionRepo = mockQuestionRepo();
    vi.mocked(questionRepo.listActiveByUserId).mockResolvedValue([q1, q2]);

    const qtRepo = mockQuestionTransactionRepo();
    vi.mocked(qtRepo.findLatestValidatedByQuestionId).mockImplementation(async (questionId) => {
      if (questionId === 'q1') return t1;
      return t2;
    });

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

  it('combines multiple entries content with separator', async () => {
    const e1 = makeEntry('user-1', 'e1');
    const e2 = makeEntry('user-1', 'e2');
    const question = makeQuestion('user-1', 'q1');
    const transaction = makeQuestionTransaction('q1', 'My question');

    const entryRepo = mockEntryRepo();
    vi.mocked(entryRepo.listByUserIdAndDate).mockResolvedValue([e1, e2]);

    const questionRepo = mockQuestionRepo();
    vi.mocked(questionRepo.listActiveByUserId).mockResolvedValue([question]);

    const qtRepo = mockQuestionTransactionRepo();
    vi.mocked(qtRepo.findLatestValidatedByQuestionId).mockResolvedValue(transaction);

    const llm = mockLlm();
    const fermentationRepo = mockFermentationRepo();

    const usecase = new ScheduledFermentationUsecase(
      entryRepo,
      questionRepo,
      qtRepo,
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
  });
});
