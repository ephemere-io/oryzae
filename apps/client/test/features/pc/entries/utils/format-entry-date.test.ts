import { describe, expect, it } from 'vitest';
import { formatEntryDate } from '@/features/pc/entries/utils/format-entry-date';
import jaMessages from '@/i18n/messages/ja.json';

function readField(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null) return undefined;
  const record: Record<string, unknown> = { ...value };
  return record[key];
}

function jaT(key: string): string {
  let cursor: unknown = readField(jaMessages, 'editor');
  for (const seg of key.split('.')) {
    cursor = readField(cursor, seg);
  }
  return typeof cursor === 'string' ? cursor : key;
}

describe('formatEntryDate', () => {
  // regression: 新規エントリは created === updated なので、以前は
  // 「2026.8.30 — 日曜日 19:18 · 19:18」と同じ時刻を2回出していた。
  it('作成と更新が同じ時刻なら、時刻を1つだけ出す', () => {
    const at = new Date(2026, 7, 30, 19, 18); // 2026-08-30 (Sun) 19:18
    expect(formatEntryDate(at, at, jaT)).toBe('2026.8.30 — 日曜日 19:18');
  });

  it('秒だけ違っても同じ時刻として扱う（読む側には同じ）', () => {
    const created = new Date(2026, 7, 30, 19, 18, 3);
    const updated = new Date(2026, 7, 30, 19, 18, 47);
    expect(formatEntryDate(created, updated, jaT)).toBe('2026.8.30 — 日曜日 19:18');
  });

  it('同日で時刻が違えば、更新時刻を矢印で繋ぐ', () => {
    const created = new Date(2026, 4, 5, 14, 0); // 2026-05-05 (Tue) 14:00
    const updated = new Date(2026, 4, 5, 16, 30); // 2026-05-05 (Tue) 16:30
    expect(formatEntryDate(created, updated, jaT)).toBe('2026.5.5 — 火曜日 14:00 → 16:30');
  });

  it('日が異なる場合は更新側の日付も出す', () => {
    const created = new Date(2026, 4, 5, 14, 0); // 2026-05-05 (Tue) 14:00
    const updated = new Date(2026, 4, 6, 9, 5); // 2026-05-06 (Wed) 09:05
    expect(formatEntryDate(created, updated, jaT)).toBe(
      '2026.5.5 — 火曜日 14:00 → 2026.5.6 水曜日 09:05',
    );
  });

  it('月をまたいでも日が異なる扱いとして両方表示される', () => {
    const created = new Date(2026, 3, 30, 23, 50); // 2026-04-30 23:50
    const updated = new Date(2026, 4, 1, 0, 5); // 2026-05-01 00:05
    expect(formatEntryDate(created, updated, jaT)).toBe(
      '2026.4.30 — 木曜日 23:50 → 2026.5.1 金曜日 00:05',
    );
  });

  it('時/分は 0 埋めされ、月/日は 0 埋めされない', () => {
    const created = new Date(2026, 0, 3, 1, 7); // 2026-01-03 01:07
    const updated = new Date(2026, 0, 3, 2, 9);
    expect(formatEntryDate(created, updated, jaT)).toBe('2026.1.3 — 土曜日 01:07 → 02:09');
  });
});
