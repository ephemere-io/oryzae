import { describe, expect, it, vi } from 'vitest';
import type { EntryRepositoryGateway } from '@/contexts/entry/domain/gateways/entry-repository.gateway.js';
import { GetFermentationReadinessUsecase } from '@/contexts/fermentation/application/usecases/get-fermentation-readiness.usecase.js';
import type { UserFermentationStateRepositoryGateway } from '@/contexts/fermentation/domain/gateways/user-fermentation-state-repository.gateway.js';
import type { UserLocaleResolverGateway } from '@/contexts/fermentation/domain/gateways/user-locale-resolver.gateway.js';
import { UserFermentationState } from '@/contexts/fermentation/domain/models/user-fermentation-state.js';

const NOW = new Date('2026-05-06T03:00:00.000Z');

function buildEntryRepo(totalChars: number): EntryRepositoryGateway {
  return {
    findById: vi.fn(),
    findByIds: vi.fn(),
    listByUserId: vi.fn(),
    listByUserIdAndDate: vi.fn().mockResolvedValue([]),
    listFermentationEnabledByUserIdAndDate: vi.fn().mockResolvedValue([]),
    listFermentationEnabledByUserIdSince: vi.fn().mockResolvedValue([]),
    countCharsByUserIdSince: vi.fn().mockResolvedValue(totalChars),
    listByUserIdAndWeek: vi.fn(),
    searchByUserId: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };
}

function buildStateRepo(
  state: UserFermentationState | null,
): UserFermentationStateRepositoryGateway {
  return {
    findByUserId: vi.fn().mockResolvedValue(state),
    upsert: vi.fn(),
  };
}

function buildLocaleResolver(language: 'ja' | 'en'): UserLocaleResolverGateway {
  return { resolve: vi.fn().mockResolvedValue(language) };
}

describe('GetFermentationReadinessUsecase', () => {
  it('新規使用者で文字数閾値未満の readiness を返す', async () => {
    const usecase = new GetFermentationReadinessUsecase(
      buildEntryRepo(500),
      buildStateRepo(null),
      buildLocaleResolver('ja'),
    );

    const result = await usecase.execute('user-1', NOW);

    expect(result.userId).toBe('user-1');
    expect(result.language).toBe('ja');
    expect(result.threshold).toBe(1000);
    expect(result.charScore).toBe(0.5);
    expect(result.timeScore).toBe(1);
    expect(result.readinessScore).toBe(0.5);
    expect(result.eligible).toBe(false);
    expect(result.isFirstTime).toBe(true);
    expect(result.lastRunAt).toBeNull();
    expect(result.nextEligibleAt).toBeNull();
    expect(result.hoursElapsed).toBeNull();
    expect(result.hoursRequired).toBeNull();
  });

  it('継続使用者で時間と文字数の達成度を返す', async () => {
    const lastRunAt = new Date(NOW.getTime() - 24 * 3600_000);
    const nextEligibleAt = new Date(lastRunAt.getTime() + 48 * 3600_000);
    const state = UserFermentationState.fromProps({
      userId: 'user-1',
      lastRunAt: lastRunAt.toISOString(),
      nextEligibleAt: nextEligibleAt.toISOString(),
      nextRandomHours: 48,
      charsSinceLast: 0,
      readinessScore: 0,
      updatedAt: lastRunAt.toISOString(),
    });

    const usecase = new GetFermentationReadinessUsecase(
      buildEntryRepo(500),
      buildStateRepo(state),
      buildLocaleResolver('ja'),
    );

    const result = await usecase.execute('user-1', NOW);

    expect(result.isFirstTime).toBe(false);
    expect(result.hoursElapsed).toBeCloseTo(24);
    expect(result.hoursRequired).toBe(48);
    expect(result.charScore).toBe(0.5);
    expect(result.timeScore).toBeCloseTo(0.5);
    expect(result.readinessScore).toBeCloseTo(0.5);
    expect(result.eligible).toBe(false);
    expect(result.lastRunAt).toBe(lastRunAt.toISOString());
    expect(result.nextEligibleAt).toBe(nextEligibleAt.toISOString());
  });

  it('英語ロケールでは閾値が 500', async () => {
    const usecase = new GetFermentationReadinessUsecase(
      buildEntryRepo(500),
      buildStateRepo(null),
      buildLocaleResolver('en'),
    );

    const result = await usecase.execute('user-1', NOW);

    expect(result.threshold).toBe(500);
    expect(result.eligible).toBe(true);
  });
});
