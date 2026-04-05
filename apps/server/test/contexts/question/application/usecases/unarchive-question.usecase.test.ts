import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnarchiveQuestionUsecase } from '@/contexts/question/application/usecases/unarchive-question.usecase';
import type { QuestionRepositoryGateway } from '@/contexts/question/domain/gateways/question-repository.gateway';
import { Question } from '@/contexts/question/domain/models/question';

describe('UnarchiveQuestionUsecase', () => {
  let questionRepo: QuestionRepositoryGateway;
  let usecase: UnarchiveQuestionUsecase;

  const archivedQuestion = Question.fromProps({
    id: 'q-1',
    userId: 'user-1',
    isArchived: true,
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
    usecase = new UnarchiveQuestionUsecase(questionRepo);
  });

  it('Question のアーカイブを解除して保存する', async () => {
    vi.mocked(questionRepo.findById).mockResolvedValue(archivedQuestion);
    vi.mocked(questionRepo.countActiveByUserId).mockResolvedValue(2);

    const result = await usecase.execute('q-1');

    expect(result.isArchived).toBe(false);
    expect(result.id).toBe('q-1');
    expect(questionRepo.save).toHaveBeenCalledTimes(1);
    const savedQuestion = vi.mocked(questionRepo.save).mock.calls[0][0];
    expect(savedQuestion.isArchived).toBe(false);
  });

  it('Question が見つからない場合は QuestionNotFoundError を throw する', async () => {
    await expect(usecase.execute('q-missing')).rejects.toThrow('Question not found: q-missing');

    expect(questionRepo.save).not.toHaveBeenCalled();
  });

  it('アクティブな Question が 3 つ以上の場合は QuestionLimitExceededError を throw する', async () => {
    vi.mocked(questionRepo.findById).mockResolvedValue(archivedQuestion);
    vi.mocked(questionRepo.countActiveByUserId).mockResolvedValue(3);

    await expect(usecase.execute('q-1')).rejects.toThrow('Maximum of 3 active questions');

    expect(questionRepo.save).not.toHaveBeenCalled();
  });
});
