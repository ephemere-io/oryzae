import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListActiveQuestionsUsecase } from '@/contexts/question/application/usecases/list-active-questions.usecase';
import type { QuestionRepositoryGateway } from '@/contexts/question/domain/gateways/question-repository.gateway';
import type { QuestionTransactionRepositoryGateway } from '@/contexts/question/domain/gateways/question-transaction-repository.gateway';
import { Question } from '@/contexts/question/domain/models/question';
import { QuestionTransaction } from '@/contexts/question/domain/models/question-transaction';

describe('ListActiveQuestionsUsecase', () => {
  let questionRepo: QuestionRepositoryGateway;
  let transactionRepo: QuestionTransactionRepositoryGateway;
  let usecase: ListActiveQuestionsUsecase;

  const activeQuestion = Question.fromProps({
    id: 'q-1',
    userId: 'user-1',
    isArchived: false,
    isValidatedByUser: true,
    isProposedByOryzae: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  const validatedTx = QuestionTransaction.fromProps({
    id: 'tx-1',
    questionId: 'q-1',
    string: 'Active question text',
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
    usecase = new ListActiveQuestionsUsecase(questionRepo, transactionRepo);
  });

  it('アクティブな Question 一覧と currentText を返す', async () => {
    vi.mocked(questionRepo.listActiveByUserId).mockResolvedValue([activeQuestion]);
    vi.mocked(transactionRepo.findLatestValidatedByQuestionId).mockResolvedValue(validatedTx);

    const result = await usecase.execute('user-1');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('q-1');
    expect(result[0].currentText).toBe('Active question text');
  });

  it('アクティブな Question がない場合は空配列を返す', async () => {
    const result = await usecase.execute('user-1');

    expect(result).toEqual([]);
  });

  it('validated な Transaction がない場合は currentText が null になる', async () => {
    vi.mocked(questionRepo.listActiveByUserId).mockResolvedValue([activeQuestion]);
    vi.mocked(transactionRepo.findLatestValidatedByQuestionId).mockResolvedValue(null);

    const result = await usecase.execute('user-1');

    expect(result[0].currentText).toBeNull();
  });
});
