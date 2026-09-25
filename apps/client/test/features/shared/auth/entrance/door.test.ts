import { describe, expect, it } from 'vitest';
import { enterPlan } from '@/features/shared/auth/entrance/door';

/**
 * 扉をくぐるとき、**紙（フォーム）の側**が退く段取り。
 *
 * 扉の開き・カメラの道のりは書斎のシーンが持っている
 * （`test/features/shared/study/scene/enter.test.ts`）。
 */
describe('enterPlan', () => {
  it('扉の正面に来たところで、行き先へ移ってよい', () => {
    const plan = enterPlan(false);
    expect(plan.totalMs).toBe(plan.walkDelayMs + plan.walkMs);
    expect(plan.fadeStartMs + plan.fadeMs).toBe(plan.totalMs);
  });

  it('行き先が書斎なら溶暗しない（同じシーンがそのまま続く）', () => {
    // 以前はどの行き先でも歩きの後半を地の色へ溶かしていて「ホワイトアウトしてブツ切れ」と
    // 報告された（PR #624）。書斎へはシーンごと渡すので、隠すための溶暗そのものが要らない。
    expect(enterPlan(false).fadeMs).toBe(0);
  });

  it('行き先が書斎でないときだけ溶暗で繋ぐ', () => {
    // `/entries/new` の先に扉の向こうの景色は無い。そこは溶かして渡すしかない。
    const plan = enterPlan(false, false);
    expect(plan.fadeMs).toBeGreaterThan(0);
    expect(plan.fadeStartMs).toBeLessThan(plan.totalMs);
  });

  it('待たされていると感じる長さにしない（1.2 秒以内）', () => {
    expect(enterPlan(false).totalMs).toBeLessThanOrEqual(1200);
  });

  it('動きを減らす設定では扉もカメラも動かさず、溶かすだけ', () => {
    const plan = enterPlan(true);
    expect(plan.doorMs).toBe(0);
    expect(plan.walkMs).toBe(0);
    expect(plan.fadeStartMs).toBe(0);
    // 溶かす長さは残す（0 だと何が起きたか分からない）。
    expect(plan.fadeMs).toBeGreaterThan(0);
    expect(plan.totalMs).toBe(plan.fadeMs);
  });
});
