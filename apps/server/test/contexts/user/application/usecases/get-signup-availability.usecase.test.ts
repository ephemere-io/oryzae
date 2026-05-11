import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GetSignupAvailabilityUsecase } from '@/contexts/user/application/usecases/get-signup-availability.usecase';
import type { UserProfileRepositoryGateway } from '@/contexts/user/domain/gateways/user-profile-repository.gateway';

describe('GetSignupAvailabilityUsecase', () => {
  let profileRepo: UserProfileRepositoryGateway;

  beforeEach(() => {
    profileRepo = {
      findById: vi.fn(),
      save: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    };
  });

  it('現在の登録数 < 上限なら remaining を計算する', async () => {
    vi.mocked(profileRepo.count).mockResolvedValue(42);
    const usecase = new GetSignupAvailabilityUsecase(profileRepo, 100);

    const result = await usecase.execute();

    expect(result).toEqual({
      limit: 100,
      used: 42,
      remaining: 58,
      capacityReached: false,
    });
    expect(profileRepo.count).toHaveBeenCalledTimes(1);
  });

  it('登録数 == 上限なら capacityReached=true', async () => {
    vi.mocked(profileRepo.count).mockResolvedValue(100);
    const usecase = new GetSignupAvailabilityUsecase(profileRepo, 100);

    const result = await usecase.execute();

    expect(result.capacityReached).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it('登録数 > 上限でも remaining は 0 にクランプ', async () => {
    vi.mocked(profileRepo.count).mockResolvedValue(150);
    const usecase = new GetSignupAvailabilityUsecase(profileRepo, 100);

    const result = await usecase.execute();

    expect(result.capacityReached).toBe(true);
    expect(result.remaining).toBe(0);
    expect(result.used).toBe(150);
  });
});
