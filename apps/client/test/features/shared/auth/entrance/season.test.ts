import { describe, expect, it } from 'vitest';
import {
  entranceSprig,
  MICRO_SEASON_COUNT,
  microSeasonIndex,
  solarLongitude,
} from '@/features/shared/auth/entrance/season';

/** 節気の名前（テストの読みやすさのため）。0 = 立春。 */
const TERM = {
  立春: 0,
  春分: 3,
  立夏: 6,
  夏至: 9,
  立秋: 12,
  秋分: 15,
  立冬: 18,
  冬至: 21,
  大寒: 23,
} as const;

/** その日は何番目の節気か。 */
function termOf(iso: string): number {
  return Math.floor(microSeasonIndex(new Date(iso)) / 3);
}

describe('solarLongitude', () => {
  // 天文の節目。太陽は 1 日でおよそ 1° 進むので、**その日のうち**に節目を通ることを見る
  // （ここで押さえたいのは式が大きく狂っていないこと。分単位の正しさは要らない）。
  it.each([
    ['2026-03-20T12:00:00Z', 0], // 春分
    ['2026-06-21T09:00:00Z', 90], // 夏至
    ['2026-09-23T04:00:00Z', 180], // 秋分
    ['2026-12-21T16:00:00Z', 270], // 冬至
  ])('%s は太陽黄経 %i° の節目の日', (iso, expected) => {
    const longitude = solarLongitude(new Date(iso));
    const diff = Math.abs(((longitude - expected + 540) % 360) - 180);
    expect(diff).toBeLessThan(1);
  });
});

describe('microSeasonIndex', () => {
  it('立春（2/4 ごろ）が 1 番目の候', () => {
    expect(termOf('2026-02-05T00:00:00Z')).toBe(TERM.立春);
  });

  it.each([
    ['2026-03-21T00:00:00Z', TERM.春分],
    ['2026-05-07T00:00:00Z', TERM.立夏],
    ['2026-06-22T00:00:00Z', TERM.夏至],
    ['2026-08-08T00:00:00Z', TERM.立秋],
    ['2026-09-24T00:00:00Z', TERM.秋分],
    ['2026-11-08T00:00:00Z', TERM.立冬],
    ['2026-12-22T00:00:00Z', TERM.冬至],
  ])('%s は節気 %i', (iso, term) => {
    expect(termOf(iso)).toBe(term);
  });

  it('一年を通して 0..71 に収まり、すべての候を通る', () => {
    const seen = new Set<number>();
    for (let day = 0; day < 366; day++) {
      const date = new Date(Date.UTC(2026, 0, 1) + day * 86_400_000);
      const index = microSeasonIndex(date);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(MICRO_SEASON_COUNT);
      seen.add(index);
    }
    expect(seen.size).toBe(MICRO_SEASON_COUNT);
  });

  it('日付が進むと候も進む（同じ候の中では変わらない）', () => {
    const start = new Date('2026-04-01T00:00:00Z');
    const later = new Date('2026-04-30T00:00:00Z');
    expect(microSeasonIndex(later)).toBeGreaterThan(microSeasonIndex(start));
  });
});

describe('entranceSprig', () => {
  it('どの候でも枝は成り立つ（葉は 0..3・先に付くのは 1 つまで）', () => {
    for (let index = 0; index < MICRO_SEASON_COUNT; index++) {
      const sprig = entranceSprig(index);
      expect(sprig.leaves).toBeGreaterThanOrEqual(0);
      expect(sprig.leaves).toBeLessThanOrEqual(3);
      const tips = [sprig.bud, sprig.blossom, sprig.berry].filter(Boolean).length;
      expect(tips).toBeLessThanOrEqual(1);
      expect(sprig.reach).toBeGreaterThan(0.8);
      expect(sprig.reach).toBeLessThanOrEqual(1);
    }
  });

  it('春は蕾から花へ、夏は葉が茂り、秋は実、冬は枝だけ', () => {
    expect(entranceSprig(TERM.立春 * 3)).toMatchObject({ bud: true, leaves: 0 });
    expect(entranceSprig(TERM.春分 * 3)).toMatchObject({ blossom: true });
    expect(entranceSprig(TERM.夏至 * 3)).toMatchObject({ leaves: 3, blossom: false });
    expect(entranceSprig(TERM.立秋 * 3)).toMatchObject({ berry: true });
    expect(entranceSprig(TERM.冬至 * 3)).toMatchObject({ leaves: 0, berry: false });
    // 大寒の末候には次の春の蕾が付く。
    expect(entranceSprig(TERM.大寒 * 3 + 2)).toMatchObject({ bud: true });
  });

  it('同じ節気の中でも、候ごとに伸びだけが少し変わる（微妙な差）', () => {
    const [first, second, third] = [0, 1, 2].map((step) => entranceSprig(TERM.夏至 * 3 + step));
    expect(first.reach).toBeLessThan(second.reach);
    expect(second.reach).toBeLessThan(third.reach);
    // 形は変えない。
    expect({ ...first, reach: 0 }).toEqual({ ...third, reach: 0 });
  });

  it('範囲の外の値でも巡って収まる（年をまたいでも壊れない）', () => {
    expect(entranceSprig(MICRO_SEASON_COUNT)).toEqual(entranceSprig(0));
    expect(entranceSprig(-1)).toEqual(entranceSprig(MICRO_SEASON_COUNT - 1));
  });
});
