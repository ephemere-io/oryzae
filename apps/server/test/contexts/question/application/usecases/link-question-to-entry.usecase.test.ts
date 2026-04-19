import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntryRepositoryGateway } from '@/contexts/entry/domain/gateways/entry-repository.gateway';
import { Entry } from '@/contexts/entry/domain/models/entry';
import { LinkQuestionToEntryUsecase } from '@/contexts/question/application/usecases/link-question-to-entry.usecase';
import type { EntryQuestionLinkRepositoryGateway } from '@/contexts/question/domain/gateways/entry-question-link-repository.gateway';
import type { QuestionRepositoryGateway } from '@/contexts/question/domain/gateways/question-repository.gateway';
import { Question } from '@/contexts/question/domain/models/question';

describe('LinkQuestionToEntryUsecase', () => {
  let linkRepo: EntryQuestionLinkRepositoryGateway;
  let questionRepo: QuestionRepositoryGateway;
  let entryRepo: EntryRepositoryGateway;
  let usecase: LinkQuestionToEntryUsecase;

  const question = Question.fromProps({
    id: 'q-1',
    userId: 'user-1',
    isArchived: false,
    isValidatedByUser: true,
    isProposedByOryzae: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  const entry = Entry.fromProps({
    id: 'entry-1',
    userId: 'user-1',
    content: 'Some entry content',
    mediaUrls: [],
    fermentationEnabled: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  beforeEach(() => {
    linkRepo = {
      link: vi.fn().mockResolvedValue(undefined),
      unlink: vi.fn().mockResolvedValue(undefined),
      listQuestionIdsByEntryId: vi.fn().mockResolvedValue([]),
    };
    questionRepo = {
      findById: vi.fn().mockResolvedValue(null),
      listActiveByUserId: vi.fn().mockResolvedValue([]),
      listAllByUserId: vi.fn().mockResolvedValue([]),
      listPendingByUserId: vi.fn().mockResolvedValue([]),
      countActiveByUserId: vi.fn().mockResolvedValue(0),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    entryRepo = {
      findById: vi.fn().mockResolvedValue(null),
      findByIds: vi.fn().mockResolvedValue([]),
      listByUserId: vi.fn().mockResolvedValue([]),
      listByUserIdAndDate: vi.fn().mockResolvedValue([]),
      listFermentationEnabledByUserIdAndDate: vi.fn().mockResolvedValue([]),
      listByUserIdAndWeek: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    usecase = new LinkQuestionToEntryUsecase(linkRepo, questionRepo, entryRepo);
  });

  it('Entry と Question を紐付ける', async () => {
    vi.mocked(entryRepo.findById).mockResolvedValue(entry);
    vi.mocked(questionRepo.findById).mockResolvedValue(question);

    await usecase.execute('entry-1', 'q-1');

    expect(linkRepo.link).toHaveBeenCalledWith('entry-1', 'q-1');
  });

  it('Entry が見つからない場合はエラーを throw する', async () => {
    vi.mocked(questionRepo.findById).mockResolvedValue(question);

    await expect(usecase.execute('entry-missing', 'q-1')).rejects.toThrow(
      'Entry not found: entry-missing',
    );

    expect(linkRepo.link).not.toHaveBeenCalled();
  });

  it('Question が見つからない場合は QuestionNotFoundError を throw する', async () => {
    vi.mocked(entryRepo.findById).mockResolvedValue(entry);

    await expect(usecase.execute('entry-1', 'q-missing')).rejects.toThrow(
      'Question not found: q-missing',
    );

    expect(linkRepo.link).not.toHaveBeenCalled();
  });
});
