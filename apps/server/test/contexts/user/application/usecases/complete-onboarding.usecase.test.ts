import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserProfileNotFoundError } from '@/contexts/user/application/errors/user.errors';
import { CompleteOnboardingUsecase } from '@/contexts/user/application/usecases/complete-onboarding.usecase';
import type { UserProfileRepositoryGateway } from '@/contexts/user/domain/gateways/user-profile-repository.gateway';
import { UserProfile } from '@/contexts/user/domain/models/user-profile';

describe('CompleteOnboardingUsecase', () => {
  let profileRepo: UserProfileRepositoryGateway;
  let usecase: CompleteOnboardingUsecase;

  const baseProfile = UserProfile.fromProps({
    id: 'user-1',
    nickname: 'taro',
    avatarUrl: null,
    onboardingCompleted: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  beforeEach(() => {
    profileRepo = {
      findById: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
    };
    usecase = new CompleteOnboardingUsecase(profileRepo);
  });

  it('プロフィールの onboardingCompleted を true にして保存する', async () => {
    vi.mocked(profileRepo.findById).mockResolvedValue(baseProfile);

    const result = await usecase.execute('user-1');

    expect(result.onboardingCompleted).toBe(true);
    expect(profileRepo.save).toHaveBeenCalledTimes(1);
    const saved = vi.mocked(profileRepo.save).mock.calls[0][0];
    expect(saved.onboardingCompleted).toBe(true);
  });

  it('既に完了済みなら save を呼ばずに結果を返す', async () => {
    const completed = UserProfile.fromProps({
      id: 'user-1',
      nickname: 'taro',
      avatarUrl: null,
      onboardingCompleted: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    vi.mocked(profileRepo.findById).mockResolvedValue(completed);

    const result = await usecase.execute('user-1');

    expect(result.onboardingCompleted).toBe(true);
    expect(profileRepo.save).not.toHaveBeenCalled();
  });

  it('プロフィールが見つからない場合は UserProfileNotFoundError を throw する', async () => {
    await expect(usecase.execute('user-missing')).rejects.toThrow(UserProfileNotFoundError);
    expect(profileRepo.save).not.toHaveBeenCalled();
  });
});
