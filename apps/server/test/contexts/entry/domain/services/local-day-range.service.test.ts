import { describe, expect, it } from 'vitest';
import {
  localDayRange,
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
