import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnlinkQuestionFromEntryUsecase } from '@/contexts/question/application/usecases/unlink-question-from-entry.usecase';
import type { EntryQuestionLinkRepositoryGateway } from '@/contexts/question/domain/gateways/entry-question-link-repository.gateway';

describe('UnlinkQuestionFromEntryUsecase', () => {
  let linkRepo: EntryQuestionLinkRepositoryGateway;
  let usecase: UnlinkQuestionFromEntryUsecase;

  beforeEach(() => {
    linkRepo = {
      link: vi.fn().mockResolvedValue(undefined),
      unlink: vi.fn().mockResolvedValue(undefined),
      listQuestionIdsByEntryId: vi.fn().mockResolvedValue([]),
    };
    usecase = new UnlinkQuestionFromEntryUsecase(linkRepo);
  });

  it('Entry と Question の紐付けを解除する', async () => {
    await usecase.execute('entry-1', 'q-1');

    expect(linkRepo.unlink).toHaveBeenCalledWith('entry-1', 'q-1');
  });
});
