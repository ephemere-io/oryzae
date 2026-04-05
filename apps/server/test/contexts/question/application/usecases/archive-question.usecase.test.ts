import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArchiveQuestionUsecase } from '@/contexts/question/application/usecases/archive-question.usecase';
import type { QuestionRepositoryGateway } from '@/contexts/question/domain/gateways/question-repository.gateway';
import { Question } from '@/contexts/question/domain/models/question';

describe('ArchiveQuestionUsecase', () => {
  let questionRepo: QuestionRepositoryGateway;
  let usecase: ArchiveQuestionUsecase;

  const activeQuestion = Question.fromProps({
    id: 'q-1',
    userId: 'user-1',
    isArchived: false,
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
    usecase = new ArchiveQuestionUsecase(questionRepo);
  });

  it('Question をアーカイブして保存する', async () => {
    vi.mocked(questionRepo.findById).mockResolvedValue(activeQuestion);

    const result = await usecase.execute('q-1');

    expect(result.isArchived).toBe(true);
    expect(result.id).toBe('q-1');
    expect(questionRepo.save).toHaveBeenCalledTimes(1);
    const savedQuestion = vi.mocked(questionRepo.save).mock.calls[0][0];
    expect(savedQuestion.isArchived).toBe(true);
  });

  it('Question が見つからない場合は QuestionNotFoundError を throw する', async () => {
    await expect(usecase.execute('q-missing')).rejects.toThrow('Question not found: q-missing');

    expect(questionRepo.save).not.toHaveBeenCalled();
  });
});
