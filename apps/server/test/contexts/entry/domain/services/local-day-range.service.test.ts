import { describe, expect, it } from 'vitest';
import {
  localDayRange,
  localMonthKey,
  localWeekRange,
} from '../../../../../src/contexts/entry/domain/services/local-day-range.service.js';

/**
 * ボードの日付境界バグ（JST 00:00〜09:00 に書いたエントリが当日のボードに出ない）の回帰テスト。
 * クライアントはローカル暦日で dateKey を作るが created_at は UTC 保存なので、
 * dateKey をそのまま UTC 窓とみなすと取りこぼす。
 */
const JST = -540; // getTimezoneOffset() は UTC − ローカル（JST = UTC+9 → -540）

describe('localDayRange', () => {
  it('オフセット未指定なら従来どおり UTC の 00:00〜翌 00:00', () => {
    expect(localDayRange('2026-08-10')).toEqual({
      startUtc: '2026-08-10T00:00:00.000Z',
      endUtc: '2026-08-11T00:00:00.000Z',
    });
  });

  it('JST ではローカル 00:00〜翌 00:00 に対応する UTC 区間を返す', () => {
    expect(localDayRange('2026-08-10', JST)).toEqual({
      startUtc: '2026-08-09T15:00:00.000Z',
      endUtc: '2026-08-10T15:00:00.000Z',
    });
  });

  it('回帰: JST 00:50 の投稿が同日のボード区間に入る', () => {
    const { startUtc, endUtc } = localDayRange('2026-08-10', JST);
    const createdAt = '2026-08-09T15:50:00.000Z'; // = JST 2026-08-10 00:50
    expect(createdAt >= startUtc && createdAt < endUtc).toBe(true);
  });

  it('回帰: 同じ投稿は UTC 基準（旧挙動）だと区間から外れる', () => {
    const { startUtc } = localDayRange('2026-08-10');
    expect('2026-08-09T15:50:00.000Z' >= startUtc).toBe(false);
  });

  it('西側のオフセット（UTC-5）でも境界が正しい', () => {
    expect(localDayRange('2026-08-10', 300)).toEqual({
      startUtc: '2026-08-10T05:00:00.000Z',
      endUtc: '2026-08-11T05:00:00.000Z',
    });
  });

  it('不正な dateKey は例外', () => {
    expect(() => localDayRange('not-a-date', JST)).toThrow();
  });
});

describe('localWeekRange', () => {
  it('月曜始まりの週を返す（2026-08-10 は月曜）', () => {
    expect(localWeekRange('2026-08-10', JST)).toEqual({
      startUtc: '2026-08-09T15:00:00.000Z',
      endUtc: '2026-08-16T15:00:00.000Z',
    });
  });

  it('週の途中（日曜）でも直前の月曜が起点になる', () => {
    // 2026-08-16 は日曜 → 週の起点は 2026-08-10(月)
    expect(localWeekRange('2026-08-16', JST).startUtc).toBe('2026-08-09T15:00:00.000Z');
  });

  it('オフセット未指定なら UTC 基準の月曜起点', () => {
    expect(localWeekRange('2026-08-10')).toEqual({
      startUtc: '2026-08-10T00:00:00.000Z',
      endUtc: '2026-08-17T00:00:00.000Z',
    });
  });
});

/**
 * 書斎の手帳は「月」で 1 冊になる（docs/oryzae-study）。日で踏んだのと同じズレを
 * 月でもう一度踏まないことを固定する。
 */
describe('localMonthKey', () => {
  it('オフセット未指定なら UTC の暦月', () => {
    expect(localMonthKey('2026-08-10T12:00:00.000Z')).toBe('2026-08');
  });

  it('JST の月初 00:00〜09:00 に書いた記録が前月に落ちない', () => {
    // JST 2026-09-01 00:50 = 2026-08-31T15:50Z。UTC のまま丸めると 2026-08 になる。
    expect(localMonthKey('2026-08-31T15:50:00.000Z', JST)).toBe('2026-09');
    expect(localMonthKey('2026-08-31T15:50:00.000Z')).toBe('2026-08');
  });

  it('JST の月末深夜が翌月に繰り上がらない', () => {
    // JST 2026-08-31 23:59 = 2026-08-31T14:59Z
    expect(localMonthKey('2026-08-31T14:59:00.000Z', JST)).toBe('2026-08');
  });

  it('年またぎ（JST 1/1 未明）で年も繰り上がる', () => {
    // JST 2027-01-01 08:00 = 2026-12-31T23:00Z
    expect(localMonthKey('2026-12-31T23:00:00.000Z', JST)).toBe('2027-01');
  });

  it('反対符号のオフセット（EST = +300）では月初が前月に戻る', () => {
    // EST 2026-08-31 20:00 = 2026-09-01T01:00Z
    expect(localMonthKey('2026-09-01T01:00:00.000Z', 300)).toBe('2026-08');
  });

  it('月を必ず 2 桁にする（1月が 2026-1 にならない）', () => {
    expect(localMonthKey('2026-01-15T00:00:00.000Z')).toBe('2026-01');
  });

  it('壊れた日時は null（集計側がその行だけ捨てられるように）', () => {
    expect(localMonthKey('not-a-date')).toBeNull();
    expect(localMonthKey('')).toBeNull();
  });
});
