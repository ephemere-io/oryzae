import { describe, expect, it } from 'vitest';
import {
  entranceSprig,
  MICRO_SEASON_COUNT,
  microSeasonIndex,
  solarLongitude,
} from '@/features/shared/study/scene/sprig';

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
  it('節気ごとに花材が替わる（24 種。ここが「季節が分かる」の正体）', () => {
    const names = new Set<string>();
    for (let term = 0; term < 24; term++) names.add(entranceSprig(term * 3).name);
    // 葉の枚数だけを増減させていたころは「あまりにも地味」と差し戻された（PR #624）。
    expect(names.size).toBe(24);
  });

  it('同じ節気の 3 つの候は同じ花材（変わるのは咲き具合・丈・本数）', () => {
    for (let term = 0; term < 24; term++) {
      const steps = [0, 1, 2].map((step) => entranceSprig(term * 3 + step));
      expect(new Set(steps.map((sprig) => sprig.name)).size).toBe(1);
      expect(new Set(steps.map((sprig) => sprig.form)).size).toBe(1);
      // 3 つが完全に同じだと、候が進んでも何も起きない。
      expect(new Set(steps.map((sprig) => JSON.stringify(sprig))).size).toBeGreaterThan(1);
    }
  });

  it('どの候でも描ける値に収まっている', () => {
    for (let index = 0; index < MICRO_SEASON_COUNT; index++) {
      const sprig = entranceSprig(index);
      expect(sprig.name.length).toBeGreaterThan(0);
      expect(sprig.stems).toBeGreaterThanOrEqual(1);
      expect(sprig.stems).toBeLessThanOrEqual(4);
      expect(sprig.height).toBeGreaterThan(0.4);
      expect(sprig.height).toBeLessThan(1.6);
      expect(sprig.bloom).toBeGreaterThanOrEqual(0);
      expect(sprig.bloom).toBeLessThanOrEqual(1);
      expect(sprig.petals).toBeGreaterThanOrEqual(0);
      expect(sprig.leaves).toBeGreaterThanOrEqual(0);
      expect(sprig.leaves).toBeLessThanOrEqual(4);
      expect(sprig.berries).toBeGreaterThanOrEqual(0);
      expect(sprig.berries).toBeLessThanOrEqual(6);
      // まっすぐ立てない（生け花ではなく標本に見える）。
      expect(sprig.lean).toBeGreaterThan(0);
    }
  });

  it('季節の草花が季節どおりに巡る', () => {
    expect(entranceSprig(0).name).toBe('梅'); // 立春
    expect(entranceSprig(3 * 3).name).toBe('桜'); // 春分
    expect(entranceSprig(9 * 3).name).toBe('笹'); // 夏至
    expect(entranceSprig(12 * 3).name).toBe('芒'); // 立秋
    expect(entranceSprig(17 * 3).name).toBe('紅葉'); // 霜降
    expect(entranceSprig(20 * 3).name).toBe('松'); // 大雪
    expect(entranceSprig(23 * 3).name).toBe('椿'); // 大寒
  });

  it('候が進むと同じ花材の蕾が開く（時間の経過として読める）', () => {
    // 立春の梅。初候はほぼ蕾、末候はほころんでいる。
    const [first, , last] = [0, 1, 2].map((step) => entranceSprig(step));
    expect(first.bloom).toBeLessThan(last.bloom);
  });

  it('範囲の外の値でも巡って収まる（年をまたいでも壊れない）', () => {
    expect(entranceSprig(MICRO_SEASON_COUNT)).toEqual(entranceSprig(0));
    expect(entranceSprig(-1)).toEqual(entranceSprig(MICRO_SEASON_COUNT - 1));
  });
});
