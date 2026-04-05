import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListAllQuestionsUsecase } from '@/contexts/question/application/usecases/list-all-questions.usecase';
import type { QuestionRepositoryGateway } from '@/contexts/question/domain/gateways/question-repository.gateway';
import type { QuestionTransactionRepositoryGateway } from '@/contexts/question/domain/gateways/question-transaction-repository.gateway';
import { Question } from '@/contexts/question/domain/models/question';
import { QuestionTransaction } from '@/contexts/question/domain/models/question-transaction';

describe('ListAllQuestionsUsecase', () => {
  let questionRepo: QuestionRepositoryGateway;
  let transactionRepo: QuestionTransactionRepositoryGateway;
  let usecase: ListAllQuestionsUsecase;

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
    isArchived: true,
    isValidatedByUser: true,
    isProposedByOryzae: false,
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  });

  const tx1 = QuestionTransaction.fromProps({
    id: 'tx-1',
    questionId: 'q-1',
    string: 'Question one',
    questionVersion: 1,
    isValidatedByUser: true,
    isProposedByOryzae: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  beforeEach(() => {
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
    usecase = new ListAllQuestionsUsecase(questionRepo, transactionRepo);
  });

  it('全 Question 一覧と currentText を返す（アーカイブ含む）', async () => {
    vi.mocked(questionRepo.listAllByUserId).mockResolvedValue([question1, question2]);
    vi.mocked(transactionRepo.findLatestValidatedByQuestionId)
      .mockResolvedValueOnce(tx1)
      .mockResolvedValueOnce(null);

    const result = await usecase.execute('user-1');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('q-1');
    expect(result[0].currentText).toBe('Question one');
    expect(result[1].id).toBe('q-2');
    expect(result[1].currentText).toBeNull();
  });

  it('Question がない場合は空配列を返す', async () => {
    const result = await usecase.execute('user-1');

    expect(result).toEqual([]);
  });
});
