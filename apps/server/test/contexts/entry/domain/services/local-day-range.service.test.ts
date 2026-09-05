import { describe, expect, it } from 'vitest';
import {
  localDayRange,
  localMonthKey,
  localMonthRange,
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

describe('localMonthRange', () => {
  it('UTC 基準では月初 00:00 から翌月初 00:00 まで', () => {
    expect(localMonthRange('2026-06')).toEqual({
      startUtc: '2026-06-01T00:00:00.000Z',
      endUtc: '2026-07-01T00:00:00.000Z',
    });
  });

  it('JST では 9 時間手前から始まる（月初 00:00〜09:00 の記録を落とさない）', () => {
    // ここがずれると、6/1 の朝に書いた記録が 5 月の冊に落ちる。
    expect(localMonthRange('2026-06', -540)).toEqual({
      startUtc: '2026-05-31T15:00:00.000Z',
      endUtc: '2026-06-30T15:00:00.000Z',
    });
  });

  it('年をまたぐ（12 月の次は翌年 1 月）', () => {
    expect(localMonthRange('2026-12')).toEqual({
      startUtc: '2026-12-01T00:00:00.000Z',
      endUtc: '2027-01-01T00:00:00.000Z',
    });
  });

  it('うるう年の 2 月は 29 日ぶん', () => {
    const { startUtc, endUtc } = localMonthRange('2028-02');
    expect(startUtc).toBe('2028-02-01T00:00:00.000Z');
    expect(endUtc).toBe('2028-03-01T00:00:00.000Z');
  });

  it('件数（localMonthKey）と同じ月の切り方になる', () => {
    // 手帳の厚みと一覧の件数が食い違わないための不変条件。
    for (const tz of [0, -540, 300]) {
      for (const month of ['2026-01', '2026-06', '2026-12']) {
        const { startUtc, endUtc } = localMonthRange(month, tz);
        expect(localMonthKey(startUtc, tz)).toBe(month);
        // 終端は含まないので、1ms 手前が同じ月であること。
        expect(localMonthKey(new Date(Date.parse(endUtc) - 1).toISOString(), tz)).toBe(month);
        // 終端そのものは翌月。
        expect(localMonthKey(endUtc, tz)).not.toBe(month);
      }
    }
  });

  it('形が違えば投げる（空の区間で黙って 0 件にしない）', () => {
    expect(() => localMonthRange('2026-6')).toThrow();
    expect(() => localMonthRange('2026-06-01')).toThrow();
    expect(() => localMonthRange('')).toThrow();
  });
});
