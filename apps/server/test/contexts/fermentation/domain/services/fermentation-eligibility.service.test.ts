import { describe, expect, it } from 'vitest';
import { UserFermentationState } from '@/contexts/fermentation/domain/models/user-fermentation-state';
import {
  evaluateEligibility,
  evaluateQuestionEligibility,
  FERMENTATION_RANDOM_HOURS_MAX,
  FERMENTATION_RANDOM_HOURS_MIN,
  rollRandomHours,
} from '@/contexts/fermentation/domain/services/fermentation-eligibility.service';

const NOW = new Date('2026-05-06T12:00:00.000Z');

describe('evaluateEligibility', () => {
  describe('新規使用者 (state == null)', () => {
    it('閾値未満なら eligible=false、charScore は比率', () => {
      const r = evaluateEligibility({ state: null, totalChars: 500, language: 'ja', now: NOW });
      expect(r.eligible).toBe(false);
      expect(r.charScore).toBe(0.5);
      expect(r.timeScore).toBe(1);
      expect(r.readinessScore).toBe(0.5);
      expect(r.threshold).toBe(1000);
      expect(r.hoursElapsed).toBeNull();
    });

    it('閾値ちょうどで eligible=true', () => {
      const r = evaluateEligibility({ state: null, totalChars: 1000, language: 'ja', now: NOW });
      expect(r.eligible).toBe(true);
      expect(r.charScore).toBe(1);
      expect(r.readinessScore).toBe(1);
    });

    it('英語ロケールは閾値 500', () => {
      const r = evaluateEligibility({ state: null, totalChars: 500, language: 'en', now: NOW });
      expect(r.threshold).toBe(500);
      expect(r.eligible).toBe(true);
    });

    it('閾値超過でも readiness は 1 にクランプ', () => {
      const r = evaluateEligibility({ state: null, totalChars: 5000, language: 'ja', now: NOW });
      expect(r.readinessScore).toBe(1);
    });
  });

  describe('継続使用者 (state あり)', () => {
    function stateWithLastRun(lastRunHoursAgo: number, randomHours: number): UserFermentationState {
      const lastRunAt = new Date(NOW.getTime() - lastRunHoursAgo * 60 * 60 * 1000);
      return UserFermentationState.fromProps({
        userId: 'u-1',
        lastRunAt: lastRunAt.toISOString(),
        nextEligibleAt: new Date(lastRunAt.getTime() + randomHours * 3600_000).toISOString(),
        nextRandomHours: randomHours,
        charsSinceLast: 0,
        readinessScore: 0,
        updatedAt: lastRunAt.toISOString(),
      });
    }

    it('文字数も時間も足りないと eligible=false', () => {
      const state = stateWithLastRun(10, 48);
      const r = evaluateEligibility({ state, totalChars: 200, language: 'ja', now: NOW });
      expect(r.eligible).toBe(false);
      expect(r.charScore).toBeCloseTo(0.2);
      expect(r.timeScore).toBeCloseTo(10 / 48);
      expect(r.readinessScore).toBeCloseTo(Math.min(0.2, 10 / 48));
    });

    it('文字数だけ満たし時間が不足なら eligible=false (readiness=timeScore)', () => {
      const state = stateWithLastRun(20, 48);
      const r = evaluateEligibility({ state, totalChars: 2000, language: 'ja', now: NOW });
      expect(r.eligible).toBe(false);
      expect(r.charScore).toBe(1);
      expect(r.timeScore).toBeCloseTo(20 / 48);
      expect(r.readinessScore).toBeCloseTo(20 / 48);
    });

    it('時間だけ満たし文字数が不足なら eligible=false (readiness=charScore)', () => {
      const state = stateWithLastRun(72, 48);
      const r = evaluateEligibility({ state, totalChars: 500, language: 'ja', now: NOW });
      expect(r.eligible).toBe(false);
      expect(r.charScore).toBe(0.5);
      expect(r.timeScore).toBe(1);
      expect(r.readinessScore).toBe(0.5);
    });

    it('両方満たすと eligible=true、readiness=1', () => {
      const state = stateWithLastRun(72, 48);
      const r = evaluateEligibility({ state, totalChars: 1500, language: 'ja', now: NOW });
      expect(r.eligible).toBe(true);
      expect(r.readinessScore).toBe(1);
      expect(r.hoursElapsed).toBeCloseTo(72);
      expect(r.hoursRequired).toBe(48);
    });

    it('nextRandomHours が null (旧データ) のときは MIN(24h) で評価する', () => {
      const lastRunAt = new Date(NOW.getTime() - 24 * 3600_000);
      const state = UserFermentationState.fromProps({
        userId: 'u-1',
        lastRunAt: lastRunAt.toISOString(),
        nextEligibleAt: null,
        nextRandomHours: null,
        charsSinceLast: 0,
        readinessScore: 0,
        updatedAt: lastRunAt.toISOString(),
      });
      const r = evaluateEligibility({ state, totalChars: 1500, language: 'ja', now: NOW });
      expect(r.hoursRequired).toBe(FERMENTATION_RANDOM_HOURS_MIN);
      expect(r.eligible).toBe(true);
    });
  });
});

describe('evaluateQuestionEligibility', () => {
  describe('未発酵の問い (lastRunAt == null)', () => {
    it('閾値未満なら eligible=false、charScore は比率', () => {
      const r = evaluateQuestionEligibility({
        lastRunAt: null,
        charsSinceLastRun: 500,
        nextRandomHours: 48,
        language: 'ja',
        now: NOW,
      });
      expect(r.eligible).toBe(false);
      expect(r.charScore).toBe(0.5);
      expect(r.timeScore).toBe(1);
      expect(r.readinessScore).toBe(0.5);
      expect(r.threshold).toBe(1000);
      expect(r.hoursElapsed).toBeNull();
      expect(r.hoursRequired).toBeNull();
    });

    it('閾値ちょうどで eligible=true', () => {
      const r = evaluateQuestionEligibility({
        lastRunAt: null,
        charsSinceLastRun: 1000,
        nextRandomHours: 48,
        language: 'ja',
        now: NOW,
      });
      expect(r.eligible).toBe(true);
      expect(r.charScore).toBe(1);
      expect(r.readinessScore).toBe(1);
    });

    it('英語ロケールは閾値 500', () => {
      const r = evaluateQuestionEligibility({
        lastRunAt: null,
        charsSinceLastRun: 500,
        nextRandomHours: null,
        language: 'en',
        now: NOW,
      });
      expect(r.threshold).toBe(500);
      expect(r.eligible).toBe(true);
    });

    it('閾値超過でも readiness は 1 にクランプ', () => {
      const r = evaluateQuestionEligibility({
        lastRunAt: null,
        charsSinceLastRun: 5000,
        nextRandomHours: null,
        language: 'ja',
        now: NOW,
      });
      expect(r.readinessScore).toBe(1);
    });
  });

  describe('発酵済みの問い (lastRunAt あり)', () => {
    function lastRunHoursAgo(hours: number): string {
      return new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString();
    }

    it('文字数も時間も足りないと eligible=false', () => {
      const r = evaluateQuestionEligibility({
        lastRunAt: lastRunHoursAgo(10),
        charsSinceLastRun: 200,
        nextRandomHours: 48,
        language: 'ja',
        now: NOW,
      });
      expect(r.eligible).toBe(false);
      expect(r.charScore).toBeCloseTo(0.2);
      expect(r.timeScore).toBeCloseTo(10 / 48);
      expect(r.readinessScore).toBeCloseTo(Math.min(0.2, 10 / 48));
    });

    it('文字数だけ満たし時間が不足なら eligible=false (readiness=timeScore)', () => {
      const r = evaluateQuestionEligibility({
        lastRunAt: lastRunHoursAgo(20),
        charsSinceLastRun: 2000,
        nextRandomHours: 48,
        language: 'ja',
        now: NOW,
      });
      expect(r.eligible).toBe(false);
      expect(r.charScore).toBe(1);
      expect(r.timeScore).toBeCloseTo(20 / 48);
      expect(r.readinessScore).toBeCloseTo(20 / 48);
    });

    it('時間だけ満たし文字数が不足なら eligible=false (readiness=charScore)', () => {
      const r = evaluateQuestionEligibility({
        lastRunAt: lastRunHoursAgo(72),
        charsSinceLastRun: 500,
        nextRandomHours: 48,
        language: 'ja',
        now: NOW,
      });
      expect(r.eligible).toBe(false);
      expect(r.charScore).toBe(0.5);
      expect(r.timeScore).toBe(1);
      expect(r.readinessScore).toBe(0.5);
    });

    it('両方満たすと eligible=true、readiness=1', () => {
      const r = evaluateQuestionEligibility({
        lastRunAt: lastRunHoursAgo(72),
        charsSinceLastRun: 1500,
        nextRandomHours: 48,
        language: 'ja',
        now: NOW,
      });
      expect(r.eligible).toBe(true);
      expect(r.readinessScore).toBe(1);
      expect(r.hoursElapsed).toBeCloseTo(72);
      expect(r.hoursRequired).toBe(48);
    });

    it('nextRandomHours が null のときは MIN(24h) で評価する', () => {
      const r = evaluateQuestionEligibility({
        lastRunAt: lastRunHoursAgo(24),
        charsSinceLastRun: 1500,
        nextRandomHours: null,
        language: 'ja',
        now: NOW,
      });
      expect(r.hoursRequired).toBe(FERMENTATION_RANDOM_HOURS_MIN);
      expect(r.eligible).toBe(true);
    });
  });
});

describe('rollRandomHours', () => {
  it('rng が 0 のとき下限 24 を返す', () => {
    expect(rollRandomHours(() => 0)).toBe(FERMENTATION_RANDOM_HOURS_MIN);
  });

  it('rng が 1 直前のとき上限 168 を返す', () => {
    expect(rollRandomHours(() => 0.9999999)).toBe(FERMENTATION_RANDOM_HOURS_MAX);
  });

  it('rng が 1 でも上限を超えない (クランプ)', () => {
    expect(rollRandomHours(() => 1)).toBe(FERMENTATION_RANDOM_HOURS_MAX);
  });

  it('整数を返す', () => {
    for (let i = 0; i < 50; i++) {
      const v = rollRandomHours();
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(FERMENTATION_RANDOM_HOURS_MIN);
      expect(v).toBeLessThanOrEqual(FERMENTATION_RANDOM_HOURS_MAX);
    }
  });
});
