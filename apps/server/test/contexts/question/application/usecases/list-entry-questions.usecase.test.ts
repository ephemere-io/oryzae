import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListEntryQuestionsUsecase } from '@/contexts/question/application/usecases/list-entry-questions.usecase';
import type { EntryQuestionLinkRepositoryGateway } from '@/contexts/question/domain/gateways/entry-question-link-repository.gateway';
import type { QuestionRepositoryGateway } from '@/contexts/question/domain/gateways/question-repository.gateway';
import type { QuestionTransactionRepositoryGateway } from '@/contexts/question/domain/gateways/question-transaction-repository.gateway';
import { Question } from '@/contexts/question/domain/models/question';
import { QuestionTransaction } from '@/contexts/question/domain/models/question-transaction';

describe('ListEntryQuestionsUsecase', () => {
  let linkRepo: EntryQuestionLinkRepositoryGateway;
  let questionRepo: QuestionRepositoryGateway;
  let transactionRepo: QuestionTransactionRepositoryGateway;
  let usecase: ListEntryQuestionsUsecase;

  const question1 = Question.fromProps({
    id: 'q-1',
    userId: 'user-1',
    isArchived: false,
    isValidatedByUser: true,
    isProposedByOryzae: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  const question2 = Question.fromProps({
    id: 'q-2',
    userId: 'user-1',
    isArchived: false,
    isValidatedByUser: true,
    isProposedByOryzae: false,
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  });

  const tx1 = QuestionTransaction.fromProps({
    id: 'tx-1',
    questionId: 'q-1',
    string: 'Question one text',
    questionVersion: 1,
    isValidatedByUser: true,
    isProposedByOryzae: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  beforeEach(() => {
    linkRepo = {
      link: vi.fn().mockResolvedValue(undefined),
      unlink: vi.fn().mockResolvedValue(undefined),
      listQuestionIdsByEntryId: vi.fn().mockResolvedValue([]),
    };
    questionRepo = {
      findById: vi.fn().mockResolvedValue(null),
      listActiveByUserId: vi.fn().mockResolvedValue([]),
      listAllByUserId: vi.fn().mockResolvedValue([]),
      listPendingByUserId: vi.fn().mockResolvedValue([]),
      countActiveByUserId: vi.fn().mockResolvedValue(0),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    transactionRepo = {
      listByQuestionId: vi.fn().mockResolvedValue([]),
      findLatestByQuestionId: vi.fn().mockResolvedValue(null),
      findLatestValidatedByQuestionId: vi.fn().mockResolvedValue(null),
      findLatestUnvalidatedByQuestionId: vi.fn().mockResolvedValue(null),
      append: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    usecase = new ListEntryQuestionsUsecase(linkRepo, questionRepo, transactionRepo);
  });

  it('Entry に紐付く Question 一覧と currentText を返す', async () => {
    vi.mocked(linkRepo.listQuestionIdsByEntryId).mockResolvedValue(['q-1', 'q-2']);
    vi.mocked(questionRepo.findById)
      .mockResolvedValueOnce(question1)
      .mockResolvedValueOnce(question2);
    vi.mocked(transactionRepo.findLatestValidatedByQuestionId)
      .mockResolvedValueOnce(tx1)
      .mockResolvedValueOnce(null);

    const result = await usecase.execute('entry-1');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('q-1');
    expect(result[0].currentText).toBe('Question one text');
    expect(result[1].id).toBe('q-2');
    expect(result[1].currentText).toBeNull();
  });

  it('紐付く Question がない場合は空配列を返す', async () => {
    const result = await usecase.execute('entry-1');

    expect(result).toEqual([]);
  });

  it('紐付く questionId の Question が削除済みの場合はスキップする', async () => {
    vi.mocked(linkRepo.listQuestionIdsByEntryId).mockResolvedValue(['q-1', 'q-deleted']);
    vi.mocked(questionRepo.findById).mockResolvedValueOnce(question1).mockResolvedValueOnce(null);
    vi.mocked(transactionRepo.findLatestValidatedByQuestionId).mockResolvedValue(tx1);

    const result = await usecase.execute('entry-1');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('q-1');
  });
});
