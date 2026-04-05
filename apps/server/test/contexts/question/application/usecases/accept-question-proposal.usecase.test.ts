import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AcceptQuestionProposalUsecase } from '@/contexts/question/application/usecases/accept-question-proposal.usecase';
import type { QuestionRepositoryGateway } from '@/contexts/question/domain/gateways/question-repository.gateway';
import type { QuestionTransactionRepositoryGateway } from '@/contexts/question/domain/gateways/question-transaction-repository.gateway';
import { Question } from '@/contexts/question/domain/models/question';
import { QuestionTransaction } from '@/contexts/question/domain/models/question-transaction';

describe('AcceptQuestionProposalUsecase', () => {
  let questionRepo: QuestionRepositoryGateway;
  let transactionRepo: QuestionTransactionRepositoryGateway;
  let usecase: AcceptQuestionProposalUsecase;

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
    usecase = new AcceptQuestionProposalUsecase(questionRepo, transactionRepo);
  });

  it('新規問い提案を承認する（Question + Transaction を validated にする）', async () => {
    const proposedQuestion = Question.fromProps({
      id: 'q-1',
      userId: 'user-1',
      isArchived: false,
      isValidatedByUser: false,
      isProposedByOryzae: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    const proposedTx = QuestionTransaction.fromProps({
      id: 'qt-1',
      questionId: 'q-1',
      string: 'AI suggested question',
      questionVersion: 1,
      isValidatedByUser: false,
      isProposedByOryzae: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });

    vi.mocked(questionRepo.findById).mockResolvedValue(proposedQuestion);
    vi.mocked(transactionRepo.findLatestUnvalidatedByQuestionId).mockResolvedValue(proposedTx);

    const result = await usecase.execute('q-1');

    expect(result.isValidatedByUser).toBe(true);
    expect(result.currentText).toBe('AI suggested question');
    expect(questionRepo.save).toHaveBeenCalledTimes(1);
    expect(transactionRepo.save).toHaveBeenCalledTimes(1);
  });

  it('存在しない Question なら QuestionNotFoundError を throw する', async () => {
    await expect(usecase.execute('nonexistent')).rejects.toThrow('Question not found');
  });

  it('アクティブ上限 3 なら新規提案を承認できない', async () => {
    const proposedQuestion = Question.fromProps({
      id: 'q-1',
      userId: 'user-1',
      isArchived: false,
      isValidatedByUser: false,
      isProposedByOryzae: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });

    vi.mocked(questionRepo.findById).mockResolvedValue(proposedQuestion);
    vi.mocked(questionRepo.countActiveByUserId).mockResolvedValue(3);

    await expect(usecase.execute('q-1')).rejects.toThrow('Maximum of 3 active questions');
  });
});
