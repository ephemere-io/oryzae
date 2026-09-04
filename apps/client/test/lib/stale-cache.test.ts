import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAllStaleCaches, readStaleCache, writeStaleCache } from '@/lib/stale-cache';

interface Sample {
  name: string;
  items: number[];
}

const OPTIONS = { version: 1, maxAgeMs: 60_000 };

function isSample(value: unknown): value is Sample {
  if (typeof value !== 'object' || value === null) return false;
  const record: Record<string, unknown> = { ...value };
  return typeof record.name === 'string' && Array.isArray(record.items);
}

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe('readStaleCache / writeStaleCache', () => {
  it('書いた値を読み戻せる', () => {
    writeStaleCache('k', { name: 'a', items: [1, 2] }, OPTIONS);
    expect(readStaleCache('k', OPTIONS, isSample)).toEqual({ name: 'a', items: [1, 2] });
  });

  it('憶えていない鍵は null', () => {
    expect(readStaleCache('missing', OPTIONS, isSample)).toBeNull();
  });

  it('版が変わったら古い値を無視する（形を変えたときに落ちない）', () => {
    writeStaleCache('k', { name: 'a', items: [] }, { version: 1, maxAgeMs: 60_000 });
    expect(readStaleCache('k', { version: 2, maxAgeMs: 60_000 }, isSample)).toBeNull();
  });

  it('古すぎる値は使わない', () => {
    writeStaleCache('k', { name: 'a', items: [] }, OPTIONS);
    // 書いた時刻より十分あとから読む。
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 120_000);
    expect(readStaleCache('k', OPTIONS, isSample)).toBeNull();
    vi.restoreAllMocks();
  });

  it('形が違う値は通さない（前の版が書いたものをそのまま描画へ流さない）', () => {
    writeStaleCache('k', { name: 123, items: 'nope' }, OPTIONS);
    expect(readStaleCache('k', OPTIONS, isSample)).toBeNull();
  });

  it('壊れた JSON でも落ちない', () => {
    localStorage.setItem('oryzae_cache:k', '{ broken');
    expect(readStaleCache('k', OPTIONS, isSample)).toBeNull();
  });

  it('封筒の形が違っても落ちない', () => {
    localStorage.setItem('oryzae_cache:k', JSON.stringify({ nope: true }));
    expect(readStaleCache('k', OPTIONS, isSample)).toBeNull();
  });

  it('書けなくても投げない（容量超過）', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => writeStaleCache('k', { name: 'a', items: [] }, OPTIONS)).not.toThrow();
    setItem.mockRestore();
  });

  it('読めなくても投げない（private mode）', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => readStaleCache('k', OPTIONS, isSample)).not.toThrow();
    getItem.mockRestore();
  });

  it('鍵が違えば混ざらない（利用者ごとに分ける前提）', () => {
    writeStaleCache('study:u1', { name: 'u1', items: [] }, OPTIONS);
    writeStaleCache('study:u2', { name: 'u2', items: [] }, OPTIONS);
    expect(readStaleCache('study:u1', OPTIONS, isSample)?.name).toBe('u1');
    expect(readStaleCache('study:u2', OPTIONS, isSample)?.name).toBe('u2');
  });
});

describe('clearAllStaleCaches', () => {
  it('憶えたものを全部捨てる（ログアウトで持ち越さない）', () => {
    writeStaleCache('study:u1', { name: 'a', items: [] }, OPTIONS);
    writeStaleCache('study:u2', { name: 'b', items: [] }, OPTIONS);

    clearAllStaleCaches();

    expect(readStaleCache('study:u1', OPTIONS, isSample)).toBeNull();
    expect(readStaleCache('study:u2', OPTIONS, isSample)).toBeNull();
  });

  it('他の用途の localStorage は消さない', () => {
    // 下書き（use-entry-draft）や既読（use-unread-letters）を巻き添えにしない。
    localStorage.setItem('oryzae_entry_draft', 'keep me');
    writeStaleCache('study:u1', { name: 'a', items: [] }, OPTIONS);

    clearAllStaleCaches();

    expect(localStorage.getItem('oryzae_entry_draft')).toBe('keep me');
  });
});
