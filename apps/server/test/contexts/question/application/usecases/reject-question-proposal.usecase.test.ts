import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RejectQuestionProposalUsecase } from '@/contexts/question/application/usecases/reject-question-proposal.usecase';
import type { QuestionRepositoryGateway } from '@/contexts/question/domain/gateways/question-repository.gateway';
import type { QuestionTransactionRepositoryGateway } from '@/contexts/question/domain/gateways/question-transaction-repository.gateway';
import { Question } from '@/contexts/question/domain/models/question';
import { QuestionTransaction } from '@/contexts/question/domain/models/question-transaction';

describe('RejectQuestionProposalUsecase', () => {
  let questionRepo: QuestionRepositoryGateway;
  let transactionRepo: QuestionTransactionRepositoryGateway;
  let usecase: RejectQuestionProposalUsecase;

  const unvalidatedQuestion = Question.fromProps({
    id: 'q-pending',
    userId: 'user-1',
    isArchived: false,
    isValidatedByUser: false,
    isProposedByOryzae: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  const validatedQuestion = Question.fromProps({
    id: 'q-active',
    userId: 'user-1',
    isArchived: false,
    isValidatedByUser: true,
    isProposedByOryzae: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  const unvalidatedTx = QuestionTransaction.fromProps({
    id: 'tx-unvalidated',
    questionId: 'q-active',
    string: 'Proposed update',
    questionVersion: 2,
    isValidatedByUser: false,
    isProposedByOryzae: true,
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
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
    usecase = new RejectQuestionProposalUsecase(questionRepo, transactionRepo);
  });

  it('未承認の Question 提案を拒否すると Question ごと削除する', async () => {
    vi.mocked(questionRepo.findById).mockResolvedValue(unvalidatedQuestion);

    await usecase.execute('q-pending');

    expect(questionRepo.delete).toHaveBeenCalledWith('q-pending');
    expect(transactionRepo.delete).not.toHaveBeenCalled();
  });

  it('承認済み Question のテキスト更新提案を拒否すると Transaction のみ削除する', async () => {
    vi.mocked(questionRepo.findById).mockResolvedValue(validatedQuestion);
    vi.mocked(transactionRepo.findLatestUnvalidatedByQuestionId).mockResolvedValue(unvalidatedTx);

    await usecase.execute('q-active');

    expect(transactionRepo.delete).toHaveBeenCalledWith('tx-unvalidated');
    expect(questionRepo.delete).not.toHaveBeenCalled();
  });

  it('Question が見つからない場合は QuestionNotFoundError を throw する', async () => {
    await expect(usecase.execute('q-missing')).rejects.toThrow('Question not found: q-missing');
  });

  it('承認済み Question に未承認 Transaction がない場合は QuestionNotPendingError を throw する', async () => {
    vi.mocked(questionRepo.findById).mockResolvedValue(validatedQuestion);
    vi.mocked(transactionRepo.findLatestUnvalidatedByQuestionId).mockResolvedValue(null);

    await expect(usecase.execute('q-active')).rejects.toThrow(
      'Question is not a pending proposal: q-active',
    );
  });
});
