import { describe, expect, it } from 'vitest';
import {
  computeSignupAvailability,
  DEFAULT_MAX_USER_COUNT,
} from '@/contexts/user/domain/policies/signup-capacity.policy';

describe('signup-capacity.policy', () => {
  it('DEFAULT_MAX_USER_COUNT は 100', () => {
    expect(DEFAULT_MAX_USER_COUNT).toBe(100);
  });

  describe('computeSignupAvailability', () => {
    it('上限未満なら capacityReached=false で remaining を返す', () => {
      expect(computeSignupAvailability(42, 100)).toEqual({
        limit: 100,
        used: 42,
        remaining: 58,
        capacityReached: false,
      });
    });

    it('上限ぴったりなら capacityReached=true、remaining=0', () => {
      expect(computeSignupAvailability(100, 100)).toEqual({
        limit: 100,
        used: 100,
        remaining: 0,
        capacityReached: true,
      });
    });

    it('上限超過時も remaining は 0 にクランプ、capacityReached=true', () => {
      expect(computeSignupAvailability(150, 100)).toEqual({
        limit: 100,
        used: 150,
        remaining: 0,
        capacityReached: true,
      });
    });

    it('used が負数なら 0 にクランプ', () => {
      expect(computeSignupAvailability(-5, 100)).toEqual({
        limit: 100,
        used: 0,
        remaining: 100,
        capacityReached: false,
      });
    });

    it('limit が 0 なら必ず capacityReached=true', () => {
      expect(computeSignupAvailability(0, 0)).toEqual({
        limit: 0,
        used: 0,
        remaining: 0,
        capacityReached: true,
      });
    });

    it('小数を渡しても floor で正規化される', () => {
      expect(computeSignupAvailability(42.9, 100.4)).toEqual({
        limit: 100,
        used: 42,
        remaining: 58,
        capacityReached: false,
      });
    });
  });
});
