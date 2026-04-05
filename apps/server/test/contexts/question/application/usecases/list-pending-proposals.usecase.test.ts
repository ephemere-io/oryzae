import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListPendingProposalsUsecase } from '@/contexts/question/application/usecases/list-pending-proposals.usecase';
import type { QuestionRepositoryGateway } from '@/contexts/question/domain/gateways/question-repository.gateway';
import type { QuestionTransactionRepositoryGateway } from '@/contexts/question/domain/gateways/question-transaction-repository.gateway';
import { Question } from '@/contexts/question/domain/models/question';
import { QuestionTransaction } from '@/contexts/question/domain/models/question-transaction';

describe('ListPendingProposalsUsecase', () => {
  let questionRepo: QuestionRepositoryGateway;
  let transactionRepo: QuestionTransactionRepositoryGateway;
  let usecase: ListPendingProposalsUsecase;

  const pendingQuestion = Question.fromProps({
    id: 'q-pending',
    userId: 'user-1',
    isArchived: false,
    isValidatedByUser: false,
    isProposedByOryzae: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  const activeQuestion = Question.fromProps({
    id: 'q-active',
    userId: 'user-1',
    isArchived: false,
    isValidatedByUser: true,
    isProposedByOryzae: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  const pendingTx = QuestionTransaction.fromProps({
    id: 'tx-pending',
    questionId: 'q-pending',
    string: 'Proposed new question',
    questionVersion: 1,
    isValidatedByUser: false,
    isProposedByOryzae: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  const unvalidatedTx = QuestionTransaction.fromProps({
    id: 'tx-unvalidated',
    questionId: 'q-active',
    string: 'Proposed text update',
    questionVersion: 2,
    isValidatedByUser: false,
    isProposedByOryzae: true,
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  });

  const currentTx = QuestionTransaction.fromProps({
    id: 'tx-current',
    questionId: 'q-active',
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
    usecase = new ListPendingProposalsUsecase(questionRepo, transactionRepo);
  });

  it('新規提案と更新提案を両方返す', async () => {
    vi.mocked(questionRepo.listPendingByUserId).mockResolvedValue([pendingQuestion]);
    vi.mocked(questionRepo.listActiveByUserId).mockResolvedValue([activeQuestion]);
    vi.mocked(transactionRepo.findLatestByQuestionId).mockResolvedValue(pendingTx);
    vi.mocked(transactionRepo.findLatestUnvalidatedByQuestionId).mockResolvedValue(unvalidatedTx);
    vi.mocked(transactionRepo.findLatestValidatedByQuestionId).mockResolvedValue(currentTx);

    const result = await usecase.execute('user-1');

    expect(result).toHaveLength(2);

    const newProposal = result.find((r) => r.proposalType === 'new');
    expect(newProposal).toBeDefined();
    expect(newProposal!.proposedText).toBe('Proposed new question');
    expect(newProposal!.currentText).toBeNull();

    const updateProposal = result.find((r) => r.proposalType === 'update');
    expect(updateProposal).toBeDefined();
    expect(updateProposal!.proposedText).toBe('Proposed text update');
    expect(updateProposal!.currentText).toBe('Current text');
  });

  it('pending な Transaction がない場合は新規提案に含めない', async () => {
    vi.mocked(questionRepo.listPendingByUserId).mockResolvedValue([pendingQuestion]);
    vi.mocked(transactionRepo.findLatestByQuestionId).mockResolvedValue(null);

    const result = await usecase.execute('user-1');

    expect(result).toEqual([]);
  });

  it('active な Question に unvalidated な Transaction がない場合は更新提案に含めない', async () => {
    vi.mocked(questionRepo.listActiveByUserId).mockResolvedValue([activeQuestion]);
    vi.mocked(transactionRepo.findLatestUnvalidatedByQuestionId).mockResolvedValue(null);

    const result = await usecase.execute('user-1');

    expect(result).toEqual([]);
  });
});
