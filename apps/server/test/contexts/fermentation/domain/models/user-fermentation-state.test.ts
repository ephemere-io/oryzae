import { describe, expect, it } from 'vitest';
import { UserFermentationState } from '@/contexts/fermentation/domain/models/user-fermentation-state';

const fixedNow = new Date('2026-05-06T00:00:00.000Z');

describe('UserFermentationState', () => {
  describe('initial', () => {
    it('新規使用者の初期状態を生成する', () => {
      const state = UserFermentationState.initial('user-1', fixedNow);
      expect(state.userId).toBe('user-1');
      expect(state.lastRunAt).toBeNull();
      expect(state.nextEligibleAt).toBeNull();
      expect(state.nextRandomHours).toBeNull();
      expect(state.charsSinceLast).toBe(0);
      expect(state.readinessScore).toBe(0);
    });
  });

  describe('fromProps / toProps', () => {
    it('ラウンドトリップで同じ Props を返す', () => {
      const props = {
        userId: 'u-1',
        lastRunAt: '2026-05-01T00:00:00.000Z',
        nextEligibleAt: '2026-05-04T00:00:00.000Z',
        nextRandomHours: 72,
        charsSinceLast: 1234,
        readinessScore: 0.42,
        updatedAt: '2026-05-01T00:00:00.000Z',
      };
      const state = UserFermentationState.fromProps(props);
      expect(state.toProps()).toEqual(props);
    });
  });

  describe('withReadiness', () => {
    it('readiness と文字数を更新する', () => {
      const state = UserFermentationState.initial('u-1', fixedNow);
      const next = state.withReadiness(500, 0.5, fixedNow);
      expect(next.success).toBe(true);
      if (next.success) {
        expect(next.value.charsSinceLast).toBe(500);
        expect(next.value.readinessScore).toBe(0.5);
        expect(next.value.lastRunAt).toBeNull(); // lastRunAt は触らない
      }
    });

    it('負の文字数で INVALID_CHARS エラーを返す', () => {
      const state = UserFermentationState.initial('u-1', fixedNow);
      const result = state.withReadiness(-1, 0.5, fixedNow);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.type).toBe('INVALID_CHARS');
    });

    it('readiness が範囲外で INVALID_READINESS_SCORE エラーを返す', () => {
      const state = UserFermentationState.initial('u-1', fixedNow);
      const tooHigh = state.withReadiness(0, 1.5, fixedNow);
      expect(tooHigh.success).toBe(false);
      if (!tooHigh.success) expect(tooHigh.error.type).toBe('INVALID_READINESS_SCORE');

      const negative = state.withReadiness(0, -0.1, fixedNow);
      expect(negative.success).toBe(false);
    });
  });

  describe('withFired', () => {
    it('発酵成功で lastRunAt を更新し、次回 X 時間に基づく nextEligibleAt を計算する', () => {
      const state = UserFermentationState.initial('u-1', fixedNow);
      const result = state.withFired(48, fixedNow);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.lastRunAt).toBe(fixedNow.toISOString());
        expect(result.value.nextRandomHours).toBe(48);
        expect(result.value.charsSinceLast).toBe(0);
        expect(result.value.readinessScore).toBe(0);
        const eligibleAt = new Date(result.value.nextEligibleAt ?? '');
        expect(eligibleAt.getTime() - fixedNow.getTime()).toBe(48 * 60 * 60 * 1000);
      }
    });

    it('範囲外の X 時間で INVALID_RANDOM_HOURS エラーを返す', () => {
      const state = UserFermentationState.initial('u-1', fixedNow);
      const tooLow = state.withFired(23, fixedNow);
      expect(tooLow.success).toBe(false);
      const tooHigh = state.withFired(169, fixedNow);
      expect(tooHigh.success).toBe(false);
      const fractional = state.withFired(48.5, fixedNow);
      expect(fractional.success).toBe(false);
    });

    it('境界値 24 と 168 を許容する', () => {
      const state = UserFermentationState.initial('u-1', fixedNow);
      expect(state.withFired(24, fixedNow).success).toBe(true);
      expect(state.withFired(168, fixedNow).success).toBe(true);
    });
  });
});
