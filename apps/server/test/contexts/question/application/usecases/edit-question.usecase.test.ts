import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditQuestionUsecase } from '@/contexts/question/application/usecases/edit-question.usecase';
import type { QuestionRepositoryGateway } from '@/contexts/question/domain/gateways/question-repository.gateway';
import type { QuestionTransactionRepositoryGateway } from '@/contexts/question/domain/gateways/question-transaction-repository.gateway';
import { Question } from '@/contexts/question/domain/models/question';
import { QuestionTransaction } from '@/contexts/question/domain/models/question-transaction';

describe('EditQuestionUsecase', () => {
  let questionRepo: QuestionRepositoryGateway;
  let transactionRepo: QuestionTransactionRepositoryGateway;
  let usecase: EditQuestionUsecase;
  let idCounter: number;

  const baseQuestion = Question.fromProps({
    id: 'q-1',
    userId: 'user-1',
    isArchived: false,
    isValidatedByUser: true,
    isProposedByOryzae: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  const existingTx = QuestionTransaction.fromProps({
    id: 'tx-1',
    questionId: 'q-1',
    string: 'Old question text',
    questionVersion: 1,
    isValidatedByUser: true,
    isProposedByOryzae: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  beforeEach(() => {
    idCounter = 0;
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
    usecase = new EditQuestionUsecase(questionRepo, transactionRepo, () => `id-${++idCounter}`);
  });

  it('既存の Question のテキストを編集して新しい Transaction を追加する', async () => {
    vi.mocked(questionRepo.findById).mockResolvedValue(baseQuestion);
    vi.mocked(transactionRepo.findLatestByQuestionId).mockResolvedValue(existingTx);

    const result = await usecase.execute('q-1', { string: 'Updated text' });

    expect(result.currentText).toBe('Updated text');
    expect(result.id).toBe('q-1');
    expect(transactionRepo.append).toHaveBeenCalledTimes(1);
    const appendedTx = vi.mocked(transactionRepo.append).mock.calls[0][0];
    expect(appendedTx.questionVersion).toBe(2);
    expect(appendedTx.isProposedByOryzae).toBe(false);
  });

  it('Transaction が存在しない場合は version 1 で作成する', async () => {
    vi.mocked(questionRepo.findById).mockResolvedValue(baseQuestion);
    vi.mocked(transactionRepo.findLatestByQuestionId).mockResolvedValue(null);

    const result = await usecase.execute('q-1', { string: 'First edit' });

    expect(result.currentText).toBe('First edit');
    const appendedTx = vi.mocked(transactionRepo.append).mock.calls[0][0];
    expect(appendedTx.questionVersion).toBe(1);
  });

  it('Question が見つからない場合は QuestionNotFoundError を throw する', async () => {
    await expect(usecase.execute('q-missing', { string: 'text' })).rejects.toThrow(
      'Question not found: q-missing',
    );

    expect(transactionRepo.append).not.toHaveBeenCalled();
  });

  it('空文字なら QuestionValidationError を throw する', async () => {
    vi.mocked(questionRepo.findById).mockResolvedValue(baseQuestion);
    vi.mocked(transactionRepo.findLatestByQuestionId).mockResolvedValue(existingTx);

    await expect(usecase.execute('q-1', { string: '' })).rejects.toThrow(
      'Question text must not be empty',
    );

    expect(transactionRepo.append).not.toHaveBeenCalled();
  });
});
