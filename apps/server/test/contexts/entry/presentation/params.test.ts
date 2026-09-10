import { describe, expect, it } from 'vitest';
import { parseMonth, parseTzOffsetMinutes } from '@/contexts/entry/presentation/params.js';

describe('parseTzOffsetMinutes', () => {
  it('getTimezoneOffset() 相当の分数をそのまま返す', () => {
    expect(parseTzOffsetMinutes('-540')).toBe(-540); // JST
    expect(parseTzOffsetMinutes('0')).toBe(0);
    expect(parseTzOffsetMinutes('300')).toBe(300); // EST
  });

  it('未指定・非数値は 0（UTC 基準）に落とす', () => {
    expect(parseTzOffsetMinutes(undefined)).toBe(0);
    expect(parseTzOffsetMinutes('')).toBe(0);
    expect(parseTzOffsetMinutes('abc')).toBe(0);
  });

  it('parseInt が通してしまう混在文字列を弾く', () => {
    // Number.parseInt('-540abc') は -540 を返す。形で縛らないと素通りする。
    expect(parseTzOffsetMinutes('-540abc')).toBe(0);
    expect(parseTzOffsetMinutes('1e3')).toBe(0);
  });

  it('実在しない範囲（±14時間超）は 0 に落とす', () => {
    expect(parseTzOffsetMinutes('840')).toBe(840); // +14:00 ちょうどは実在する
    expect(parseTzOffsetMinutes('841')).toBe(0);
    expect(parseTzOffsetMinutes('-841')).toBe(0);
    expect(parseTzOffsetMinutes('99999')).toBe(0);
  });
});

describe('parseMonth', () => {
  it('YYYY-MM を受ける', () => {
    expect(parseMonth('2026-06')).toBe('2026-06');
    expect(parseMonth('  2026-12  ')).toBe('2026-12');
  });

  it('形が違えば絞らない（undefined）', () => {
    expect(parseMonth(undefined)).toBeUndefined();
    expect(parseMonth('')).toBeUndefined();
    expect(parseMonth('2026-6')).toBeUndefined();
    expect(parseMonth('2026-06-01')).toBeUndefined();
    expect(parseMonth('abc')).toBeUndefined();
  });

  it('実在しない月は受けない', () => {
    // 通すと空の区間で必ず 0 件になり、「その月には無い」と区別がつかない。
    expect(parseMonth('2026-00')).toBeUndefined();
    expect(parseMonth('2026-13')).toBeUndefined();
  });
});
