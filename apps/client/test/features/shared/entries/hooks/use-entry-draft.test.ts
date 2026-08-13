import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DRAFT_MAX_IDLE_MS,
  isDraftFresh,
  localDateKey,
  useEntryDraft,
} from '@/features/shared/entries/hooks/use-entry-draft';
import type { EntryDraft } from '@/features/shared/entries/types';

const STORAGE_KEY = 'oryzae:sp:new-entry-draft';

describe('localDateKey', () => {
  it('ローカル暦日を YYYY-MM-DD で返す', () => {
    const ms = new Date(2026, 5, 28, 9, 30).getTime();
    expect(localDateKey(ms)).toBe('2026-06-28');
  });

  it('月・日をゼロ埋めする', () => {
    const ms = new Date(2026, 0, 3, 0, 0).getTime();
    expect(localDateKey(ms)).toBe('2026-01-03');
  });
});

describe('isDraftFresh', () => {
  const base: EntryDraft = { title: '', body: 'x', questionId: null, updatedAt: 0, dateKey: '' };

  it('同じ暦日かつ猶予内なら true', () => {
    const now = new Date(2026, 5, 28, 12, 0).getTime();
    const draft = { ...base, updatedAt: now - 10 * 60 * 1000, dateKey: localDateKey(now) };
    expect(isDraftFresh(draft, now)).toBe(true);
  });

  it('猶予を超えたら false', () => {
    const now = new Date(2026, 5, 28, 12, 0).getTime();
    const draft = { ...base, updatedAt: now - (DRAFT_MAX_IDLE_MS + 1), dateKey: localDateKey(now) };
    expect(isDraftFresh(draft, now)).toBe(false);
  });

  it('日付をまたいだら猶予内でも false', () => {
    const prev = new Date(2026, 5, 27, 23, 55).getTime();
    const now = new Date(2026, 5, 28, 0, 10).getTime();
    expect(now - prev).toBeLessThan(DRAFT_MAX_IDLE_MS);
    const draft = { ...base, updatedAt: prev, dateKey: localDateKey(prev) };
    expect(isDraftFresh(draft, now)).toBe(false);
  });
});

describe('useEntryDraft', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('save → load で新鮮なドラフトを復元できる', () => {
    vi.setSystemTime(new Date(2026, 5, 28, 12, 0));
    const { result } = renderHook(() => useEntryDraft());

    result.current.save({ entryId: 'e1', title: 't', body: 'b', questionId: 'q1' });
    const loaded = result.current.load();

    expect(loaded).toMatchObject({
      entryId: 'e1',
      title: 't',
      body: 'b',
      questionId: 'q1',
      dateKey: '2026-06-28',
    });
  });

  it('猶予を超えた古いドラフトは load で null かつ localStorage から削除される', () => {
    vi.setSystemTime(new Date(2026, 5, 28, 12, 0));
    const { result } = renderHook(() => useEntryDraft());
    result.current.save({ title: 't', body: 'b', questionId: null });

    vi.setSystemTime(new Date(2026, 5, 28, 12, 0).getTime() + DRAFT_MAX_IDLE_MS + 1000);

    expect(result.current.load()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('日付をまたいだら load で null', () => {
    vi.setSystemTime(new Date(2026, 5, 27, 23, 55));
    const { result } = renderHook(() => useEntryDraft());
    result.current.save({ title: 't', body: 'b', questionId: null });

    vi.setSystemTime(new Date(2026, 5, 28, 0, 5)); // 翌日（猶予1時間内）でも日付境界で破棄
    expect(result.current.load()).toBeNull();
  });

  it('clear でドラフトが削除される', () => {
    vi.setSystemTime(new Date(2026, 5, 28, 12, 0));
    const { result } = renderHook(() => useEntryDraft());
    result.current.save({ title: 't', body: 'b', questionId: null });

    result.current.clear();
    expect(result.current.load()).toBeNull();
  });

  it('壊れた JSON は load で null（クラッシュしない）', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    const { result } = renderHook(() => useEntryDraft());
    expect(result.current.load()).toBeNull();
  });

  it('スキーマ不正なオブジェクトは load で null かつ削除される', () => {
    vi.setSystemTime(new Date(2026, 5, 28, 12, 0));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ title: 't' }));
    const { result } = renderHook(() => useEntryDraft());
    expect(result.current.load()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
