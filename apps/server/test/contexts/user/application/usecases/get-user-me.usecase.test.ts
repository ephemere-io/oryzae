import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserProfileNotFoundError } from '@/contexts/user/application/errors/user.errors';
import { GetUserMeUsecase } from '@/contexts/user/application/usecases/get-user-me.usecase';
import type { UserActivityStatsRepositoryGateway } from '@/contexts/user/domain/gateways/user-activity-stats-repository.gateway';
import type { UserProfileRepositoryGateway } from '@/contexts/user/domain/gateways/user-profile-repository.gateway';
import { UserProfile } from '@/contexts/user/domain/models/user-profile';

describe('GetUserMeUsecase', () => {
  let profileRepo: UserProfileRepositoryGateway;
  let statsRepo: UserActivityStatsRepositoryGateway;
  let usecase: GetUserMeUsecase;

  const baseProfile = UserProfile.fromProps({
    id: 'user-1',
    nickname: 'taro',
    avatarUrl: null,
    onboardingCompleted: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  beforeEach(() => {
    profileRepo = {
      findById: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
      count: vi.fn().mockResolvedValue(0),
    };
    statsRepo = {
      hasPickled: vi.fn().mockResolvedValue(false),
      hasLinkedQuestion: vi.fn().mockResolvedValue(false),
    };
    usecase = new GetUserMeUsecase(profileRepo, statsRepo);
  });

  it('プロフィールと集計フラグ (false/false) を返す', async () => {
    vi.mocked(profileRepo.findById).mockResolvedValue(baseProfile);

    const view = await usecase.execute('user-1');

    expect(view).toEqual({
      id: 'user-1',
      nickname: 'taro',
      avatarUrl: null,
      onboardingCompleted: true,
      hasPickled: false,
      hasLinkedQuestion: false,
    });
    expect(statsRepo.hasPickled).toHaveBeenCalledWith('user-1');
    expect(statsRepo.hasLinkedQuestion).toHaveBeenCalledWith('user-1');
  });

  it('一度でも漬け込んでいれば hasPickled=true', async () => {
    vi.mocked(profileRepo.findById).mockResolvedValue(baseProfile);
    vi.mocked(statsRepo.hasPickled).mockResolvedValue(true);

    const view = await usecase.execute('user-1');

    expect(view.hasPickled).toBe(true);
    expect(view.hasLinkedQuestion).toBe(false);
  });

  it('一度でも問いを紐付けていれば hasLinkedQuestion=true', async () => {
    vi.mocked(profileRepo.findById).mockResolvedValue(baseProfile);
    vi.mocked(statsRepo.hasLinkedQuestion).mockResolvedValue(true);

    const view = await usecase.execute('user-1');

    expect(view.hasPickled).toBe(false);
    expect(view.hasLinkedQuestion).toBe(true);
  });

  it('プロフィールが無ければ UserProfileNotFoundError を throw する', async () => {
    await expect(usecase.execute('missing-user')).rejects.toThrow(UserProfileNotFoundError);
    expect(statsRepo.hasPickled).not.toHaveBeenCalled();
    expect(statsRepo.hasLinkedQuestion).not.toHaveBeenCalled();
  });
});
