import { describe, expect, it, vi } from 'vitest';
import type { EntryRepositoryGateway } from '@/contexts/entry/domain/gateways/entry-repository.gateway.js';
import { Entry } from '@/contexts/entry/domain/models/entry.js';
import { FireFermentationUsecase } from '@/contexts/fermentation/application/usecases/fire-fermentation.usecase.js';
import type { FermentationRepositoryGateway } from '@/contexts/fermentation/domain/gateways/fermentation-repository.gateway.js';
import type { LlmAnalysisGateway } from '@/contexts/fermentation/domain/gateways/llm-analysis.gateway.js';
import type { EntryQuestionLinkRepositoryGateway } from '@/contexts/question/domain/gateways/entry-question-link-repository.gateway.js';
import type { QuestionRepositoryGateway } from '@/contexts/question/domain/gateways/question-repository.gateway.js';
import type { QuestionTransactionRepositoryGateway } from '@/contexts/question/domain/gateways/question-transaction-repository.gateway.js';
import { Question } from '@/contexts/question/domain/models/question.js';
import { QuestionTransaction } from '@/contexts/question/domain/models/question-transaction.js';

const generateId = () => 'test-id';

function makeEntry(
  userId: string,
  id: string,
  fermentationEnabled = true,
  content = `Entry ${id}`,
): Entry {
  return Entry.fromProps({
    id,
    userId,
    content,
    mediaUrls: [],
    fermentationEnabled,
    createdAt: '2026-05-04T10:00:00.000Z',
    updatedAt: '2026-05-04T10:00:00.000Z',
  });
}

function makeQuestion(userId: string, id: string, isArchived = false): Question {
  return Question.fromProps({
    id,
    userId,
    isArchived,
    isValidatedByUser: true,
    isProposedByOryzae: false,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  });
}

function makeTransaction(questionId: string, text: string): QuestionTransaction {
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

function mockQtRepo(): QuestionTransactionRepositoryGateway {
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
    findById: vi.fn(),
    listByUserId: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    saveScannedEntries: vi.fn(),
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
        worksheetMarkdown: 'ws',
        resultDiagramMarkdown: 'rd',
        snippets: [],
        letterBody: 'letter',
        keywords: [],
      },
      generationId: 'gen-1',
    }),
  };
}

interface BuildArgs {
  entryRepo?: EntryRepositoryGateway;
  questionRepo?: QuestionRepositoryGateway;
  qtRepo?: QuestionTransactionRepositoryGateway;
  linkRepo?: EntryQuestionLinkRepositoryGateway;
  fermentationRepo?: FermentationRepositoryGateway;
  llm?: LlmAnalysisGateway;
}

function buildUsecase(args: BuildArgs = {}): FireFermentationUsecase {
  return new FireFermentationUsecase(
    args.entryRepo ?? mockEntryRepo(),
    args.questionRepo ?? mockQuestionRepo(),
    args.qtRepo ?? mockQtRepo(),
    args.linkRepo ?? mockLinkRepo(),
    args.fermentationRepo ?? mockFermentationRepo(),
    args.llm ?? mockLlm(),
    generateId,
  );
}

describe('FireFermentationUsecase (issue #290: admin debug fire)', () => {
  it('fires for all active questions when questionId is omitted', async () => {
    const q1 = makeQuestion('u1', 'q1');
    const q2 = makeQuestion('u1', 'q2');
    const t1 = makeTransaction('q1', 'Q1 text');
    const t2 = makeTransaction('q2', 'Q2 text');
    const entry = makeEntry('u1', 'e1');

    const questionRepo = mockQuestionRepo();
    vi.mocked(questionRepo.listActiveByUserId).mockResolvedValue([q1, q2]);

    const qtRepo = mockQtRepo();
    vi.mocked(qtRepo.findLatestValidatedByQuestionId).mockImplementation(async (id) =>
      id === 'q1' ? t1 : t2,
    );

    const linkRepo = mockLinkRepo();
    vi.mocked(linkRepo.listEntryIdsByQuestionId).mockResolvedValue(['e1']);

    const entryRepo = mockEntryRepo();
    vi.mocked(entryRepo.findByIds).mockResolvedValue([entry]);

    const llm = mockLlm();

    const usecase = buildUsecase({ questionRepo, qtRepo, linkRepo, entryRepo, llm });

    const result = await usecase.execute({ userId: 'u1' });

    expect(result.fired).toHaveLength(2);
    expect(result.fired.map((f) => f.questionId)).toEqual(['q1', 'q2']);
    expect(result.fired.map((f) => f.questionText)).toEqual(['Q1 text', 'Q2 text']);
    expect(llm.analyze).toHaveBeenCalledTimes(2);
  });

  it('fires only the specified questionId when provided', async () => {
    const q1 = makeQuestion('u1', 'q1');
    const q2 = makeQuestion('u1', 'q2');
    const t2 = makeTransaction('q2', 'Q2 text');

    const questionRepo = mockQuestionRepo();
    vi.mocked(questionRepo.listActiveByUserId).mockResolvedValue([q1, q2]);

    const qtRepo = mockQtRepo();
    vi.mocked(qtRepo.findLatestValidatedByQuestionId).mockResolvedValue(t2);

    const linkRepo = mockLinkRepo();
    vi.mocked(linkRepo.listEntryIdsByQuestionId).mockResolvedValue(['e1']);

    const entryRepo = mockEntryRepo();
    vi.mocked(entryRepo.findByIds).mockResolvedValue([makeEntry('u1', 'e1')]);

    const llm = mockLlm();

    const usecase = buildUsecase({ questionRepo, qtRepo, linkRepo, entryRepo, llm });

    const result = await usecase.execute({ userId: 'u1', questionId: 'q2' });

    expect(result.fired).toHaveLength(1);
    expect(result.fired[0].questionId).toBe('q2');
    expect(llm.analyze).toHaveBeenCalledOnce();
    expect(qtRepo.findLatestValidatedByQuestionId).toHaveBeenCalledWith('q2');
  });

  it('throws when questionId is specified but not active for the user', async () => {
    const q1 = makeQuestion('u1', 'q1');
    const questionRepo = mockQuestionRepo();
    vi.mocked(questionRepo.listActiveByUserId).mockResolvedValue([q1]);

    const usecase = buildUsecase({ questionRepo });

    await expect(usecase.execute({ userId: 'u1', questionId: 'q-other' })).rejects.toThrow(
      /not found or not active/,
    );
  });

  it('throws when user has no active questions at all', async () => {
    const usecase = buildUsecase();
    await expect(usecase.execute({ userId: 'u1' })).rejects.toThrow(/No active questions found/);
  });

  it('bypasses fermentation_enabled flag (entries with enabled=false are still used)', async () => {
    const q1 = makeQuestion('u1', 'q1');
    const t1 = makeTransaction('q1', 'Q1 text');
    const disabledEntry = makeEntry('u1', 'e-disabled', /* fermentationEnabled */ false);

    const questionRepo = mockQuestionRepo();
    vi.mocked(questionRepo.listActiveByUserId).mockResolvedValue([q1]);

    const qtRepo = mockQtRepo();
    vi.mocked(qtRepo.findLatestValidatedByQuestionId).mockResolvedValue(t1);

    const linkRepo = mockLinkRepo();
    vi.mocked(linkRepo.listEntryIdsByQuestionId).mockResolvedValue(['e-disabled']);

    const entryRepo = mockEntryRepo();
    vi.mocked(entryRepo.findByIds).mockResolvedValue([disabledEntry]);

    const llm = mockLlm();

    const usecase = buildUsecase({ questionRepo, qtRepo, linkRepo, entryRepo, llm });

    const result = await usecase.execute({ userId: 'u1', questionId: 'q1' });

    expect(result.fired).toHaveLength(1);
    expect(llm.analyze).toHaveBeenCalledOnce();
  });

  it('filters out entries belonging to other users (defensive)', async () => {
    const q1 = makeQuestion('u1', 'q1');
    const t1 = makeTransaction('q1', 'Q1 text');
    const ownEntry = makeEntry('u1', 'e-own');
    const foreignEntry = makeEntry('u-other', 'e-foreign');

    const questionRepo = mockQuestionRepo();
    vi.mocked(questionRepo.listActiveByUserId).mockResolvedValue([q1]);

    const qtRepo = mockQtRepo();
    vi.mocked(qtRepo.findLatestValidatedByQuestionId).mockResolvedValue(t1);

    const linkRepo = mockLinkRepo();
    vi.mocked(linkRepo.listEntryIdsByQuestionId).mockResolvedValue(['e-own', 'e-foreign']);

    const entryRepo = mockEntryRepo();
    vi.mocked(entryRepo.findByIds).mockResolvedValue([ownEntry, foreignEntry]);

    const llm = mockLlm();
    vi.mocked(llm.analyze).mockResolvedValue({
      output: {
        worksheetMarkdown: 'ws',
        resultDiagramMarkdown: 'rd',
        snippets: [],
        letterBody: 'letter',
        keywords: [],
      },
      generationId: null,
    });

    const usecase = buildUsecase({ questionRepo, qtRepo, linkRepo, entryRepo, llm });

    await usecase.execute({ userId: 'u1', questionId: 'q1' });

    // RunFermentationUsecase に渡されたエントリは own のみ
    const analyzeCall = vi.mocked(llm.analyze).mock.calls[0][0];
    expect(analyzeCall.entryContent).toBe(ownEntry.toProps().content);
  });

  it('skips questions with no linked entries and throws if nothing fires', async () => {
    const q1 = makeQuestion('u1', 'q1');
    const questionRepo = mockQuestionRepo();
    vi.mocked(questionRepo.listActiveByUserId).mockResolvedValue([q1]);

    const linkRepo = mockLinkRepo();
    vi.mocked(linkRepo.listEntryIdsByQuestionId).mockResolvedValue([]);

    const usecase = buildUsecase({ questionRepo, linkRepo });

    await expect(usecase.execute({ userId: 'u1' })).rejects.toThrow(/No fermentations were fired/);
  });

  it('skips questions with no validated transaction', async () => {
    const q1 = makeQuestion('u1', 'q1');
    const q2 = makeQuestion('u1', 'q2');
    const t2 = makeTransaction('q2', 'Q2 text');

    const questionRepo = mockQuestionRepo();
    vi.mocked(questionRepo.listActiveByUserId).mockResolvedValue([q1, q2]);

    const qtRepo = mockQtRepo();
    vi.mocked(qtRepo.findLatestValidatedByQuestionId).mockImplementation(async (id) =>
      id === 'q1' ? null : t2,
    );

    const linkRepo = mockLinkRepo();
    vi.mocked(linkRepo.listEntryIdsByQuestionId).mockResolvedValue(['e1']);

    const entryRepo = mockEntryRepo();
    vi.mocked(entryRepo.findByIds).mockResolvedValue([makeEntry('u1', 'e1')]);

    const usecase = buildUsecase({ questionRepo, qtRepo, linkRepo, entryRepo });

    const result = await usecase.execute({ userId: 'u1' });

    expect(result.fired).toHaveLength(1);
    expect(result.fired[0].questionId).toBe('q2');
  });

  it('passes language through to RunFermentation', async () => {
    const q1 = makeQuestion('u1', 'q1');
    const t1 = makeTransaction('q1', 'Q1 text');

    const questionRepo = mockQuestionRepo();
    vi.mocked(questionRepo.listActiveByUserId).mockResolvedValue([q1]);

    const qtRepo = mockQtRepo();
    vi.mocked(qtRepo.findLatestValidatedByQuestionId).mockResolvedValue(t1);

    const linkRepo = mockLinkRepo();
    vi.mocked(linkRepo.listEntryIdsByQuestionId).mockResolvedValue(['e1']);

    const entryRepo = mockEntryRepo();
    vi.mocked(entryRepo.findByIds).mockResolvedValue([makeEntry('u1', 'e1')]);

    const llm = mockLlm();

    const usecase = buildUsecase({ questionRepo, qtRepo, linkRepo, entryRepo, llm });

    await usecase.execute({ userId: 'u1', language: 'en' });

    expect(llm.analyze).toHaveBeenCalledWith(expect.objectContaining({ language: 'en' }));
  });
});
