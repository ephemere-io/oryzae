import { describe, expect, it } from 'vitest';
import { formatEntryDate } from '@/features/entries/components/format-entry-date';
import jaMessages from '@/i18n/messages/ja.json';

function jaT(key: string): string {
  const segments = key.split('.');
  let cursor: unknown = (jaMessages as Record<string, unknown>).editor;
  for (const seg of segments) {
    if (typeof cursor !== 'object' || cursor === null) return key;
    cursor = (cursor as Record<string, unknown>)[seg];
  }
  return typeof cursor === 'string' ? cursor : key;
}

describe('formatEntryDate', () => {
  it('同日の場合は date を 1 つだけ表示し、時刻範囲を中黒で繋ぐ', () => {
    const created = new Date(2026, 4, 5, 14, 0); // 2026-05-05 (Tue) 14:00
    const updated = new Date(2026, 4, 5, 16, 30); // 2026-05-05 (Tue) 16:30
    expect(formatEntryDate(created, updated, jaT)).toBe('2026.5.5 — 火曜日 14:00 · 16:30');
  });

  it('日が異なる場合は created/updated それぞれの date+time を em dash で繋ぐ', () => {
    const created = new Date(2026, 4, 5, 14, 0); // 2026-05-05 (Tue) 14:00
    const updated = new Date(2026, 4, 6, 9, 5); // 2026-05-06 (Wed) 09:05
    expect(formatEntryDate(created, updated, jaT)).toBe(
      '2026.5.5 火曜日 14:00 — 2026.5.6 水曜日 09:05',
    );
  });

  it('月をまたいでも日が異なる扱いとして両方表示される', () => {
    const created = new Date(2026, 3, 30, 23, 50); // 2026-04-30 23:50
    const updated = new Date(2026, 4, 1, 0, 5); // 2026-05-01 00:05
    expect(formatEntryDate(created, updated, jaT)).toBe(
      '2026.4.30 木曜日 23:50 — 2026.5.1 金曜日 00:05',
    );
  });

  it('時/分は 0 埋めされ、月/日は 0 埋めされない', () => {
    const created = new Date(2026, 0, 3, 1, 7); // 2026-01-03 01:07
    const updated = new Date(2026, 0, 3, 2, 9);
    expect(formatEntryDate(created, updated, jaT)).toBe('2026.1.3 — 土曜日 01:07 · 02:09');
  });
});
