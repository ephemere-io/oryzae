import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GetQuestionUsecase } from '@/contexts/question/application/usecases/get-question.usecase';
import type { QuestionRepositoryGateway } from '@/contexts/question/domain/gateways/question-repository.gateway';
import type { QuestionTransactionRepositoryGateway } from '@/contexts/question/domain/gateways/question-transaction-repository.gateway';
import { Question } from '@/contexts/question/domain/models/question';
import { QuestionTransaction } from '@/contexts/question/domain/models/question-transaction';

describe('GetQuestionUsecase', () => {
  let questionRepo: QuestionRepositoryGateway;
  let transactionRepo: QuestionTransactionRepositoryGateway;
  let usecase: GetQuestionUsecase;

  const baseQuestion = Question.fromProps({
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
    string: 'Current text',
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
    usecase = new GetQuestionUsecase(questionRepo, transactionRepo);
  });

  it('Question と Transaction 一覧と currentText を返す', async () => {
    vi.mocked(questionRepo.findById).mockResolvedValue(baseQuestion);
    vi.mocked(transactionRepo.listByQuestionId).mockResolvedValue([validatedTx]);
    vi.mocked(transactionRepo.findLatestValidatedByQuestionId).mockResolvedValue(validatedTx);

    const result = await usecase.execute('q-1');

    expect(result).not.toBeNull();
    expect(result!.question.id).toBe('q-1');
    expect(result!.currentText).toBe('Current text');
    expect(result!.transactions).toHaveLength(1);
    expect(result!.transactions[0].id).toBe('tx-1');
  });

  it('validated な Transaction がない場合は currentText が null になる', async () => {
    vi.mocked(questionRepo.findById).mockResolvedValue(baseQuestion);
    vi.mocked(transactionRepo.findLatestValidatedByQuestionId).mockResolvedValue(null);

    const result = await usecase.execute('q-1');

    expect(result).not.toBeNull();
    expect(result!.currentText).toBeNull();
  });

  it('Question が見つからない場合は null を返す', async () => {
    const result = await usecase.execute('q-missing');

    expect(result).toBeNull();
    expect(transactionRepo.listByQuestionId).not.toHaveBeenCalled();
  });
});
