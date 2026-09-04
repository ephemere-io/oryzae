import { describe, expect, it } from 'vitest';
import {
  fermentations,
  toOwnerReadinessView,
} from '@/contexts/fermentation/presentation/routes/fermentations.js';

describe('toOwnerReadinessView', () => {
  it('本人向けには readiness / eligible / nextRunAt の 3 つだけを出す', () => {
    const view = toOwnerReadinessView({
      readinessScore: 0.5,
      eligible: false,
      nextEligibleAt: '2026-09-05T00:00:00.000Z',
    });

    expect(view).toEqual({
      readiness: 0.5,
      eligible: false,
      nextRunAt: '2026-09-05T00:00:00.000Z',
    });
    // 閾値・文字数・経過時間は本人向けに出さない（admin 版との差はここ）。
    expect(Object.keys(view).sort()).toEqual(['eligible', 'nextRunAt', 'readiness']);
  });

  it('readiness を小数第2位に丸める（生の charScore から文字数を逆算させない）', () => {
    // 1000字閾値で 637 字 → 0.637。丸めないと「637字書いた」がそのまま漏れる。
    expect(toOwnerReadinessView(evaluationWith(0.637)).readiness).toBe(0.64);
    expect(toOwnerReadinessView(evaluationWith(0.004)).readiness).toBe(0);
    expect(toOwnerReadinessView(evaluationWith(0.999)).readiness).toBe(1);
  });

  it('0 と 1 の端をそのまま通す', () => {
    expect(toOwnerReadinessView(evaluationWith(0)).readiness).toBe(0);
    expect(toOwnerReadinessView(evaluationWith(1)).readiness).toBe(1);
  });

  it('未発酵（時間ゲート無し）では nextRunAt が null になる', () => {
    const view = toOwnerReadinessView({
      readinessScore: 0.3,
      eligible: false,
      nextEligibleAt: null,
    });
    expect(view.nextRunAt).toBeNull();
  });
});

describe('fermentations のルート登録順', () => {
  it('GET /readiness が GET /:id より前に登録されている', () => {
    // Hono は登録順に照合する。逆だと /readiness が id="readiness" の詳細取得として
    // 食われ、404 でも 500 でもなく「そんな発酵は無い」応答になって原因が見えにくい。
    const getPaths = fermentations.routes
      .filter((route) => route.method === 'GET')
      .map((route) => route.path);

    const readinessAt = getPaths.indexOf('/readiness');
    const detailAt = getPaths.indexOf('/:id');

    expect(readinessAt).toBeGreaterThanOrEqual(0);
    expect(detailAt).toBeGreaterThanOrEqual(0);
    expect(readinessAt).toBeLessThan(detailAt);
  });
});

function evaluationWith(readinessScore: number) {
  return { readinessScore, eligible: readinessScore >= 1, nextEligibleAt: null };
}
