import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateQuestionUsecase } from '@/contexts/question/application/usecases/create-question.usecase';
import type { QuestionRepositoryGateway } from '@/contexts/question/domain/gateways/question-repository.gateway';
import type { QuestionTransactionRepositoryGateway } from '@/contexts/question/domain/gateways/question-transaction-repository.gateway';

describe('CreateQuestionUsecase', () => {
  let questionRepo: QuestionRepositoryGateway;
  let transactionRepo: QuestionTransactionRepositoryGateway;
  let usecase: CreateQuestionUsecase;
  let idCounter: number;

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
    usecase = new CreateQuestionUsecase(questionRepo, transactionRepo, () => `id-${++idCounter}`);
  });

  it('Question と Transaction を作成して保存する', async () => {
    const result = await usecase.execute('user-1', { string: 'What is love?' });

    expect(result.currentText).toBe('What is love?');
    expect(result.isValidatedByUser).toBe(true);
    expect(result.isProposedByOryzae).toBe(false);
    expect(questionRepo.save).toHaveBeenCalledTimes(1);
    expect(transactionRepo.append).toHaveBeenCalledTimes(1);
  });

  it('アクティブ問いが 3 つなら QuestionLimitExceededError を throw する', async () => {
    vi.mocked(questionRepo.countActiveByUserId).mockResolvedValue(3);

    await expect(usecase.execute('user-1', { string: 'Too many' })).rejects.toThrow(
      'Maximum of 3 active questions',
    );

    expect(questionRepo.save).not.toHaveBeenCalled();
  });

  it('空文字なら QuestionValidationError を throw する', async () => {
    await expect(usecase.execute('user-1', { string: '' })).rejects.toThrow(
      'Question text must not be empty',
    );

    expect(questionRepo.save).not.toHaveBeenCalled();
  });
});
