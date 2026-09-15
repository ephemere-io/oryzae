import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearEntryLocalCopy,
  readEntryLocalCopy,
  useEntryLocalCopy,
} from '@/features/shared/entries/hooks/use-entry-local-copy';

describe('useEntryLocalCopy（端末の写し）', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  it('サーバーの内容と違う間は 300ms 後に写しを置く', () => {
    renderHook(() =>
      useEntryLocalCopy({
        entryId: 'e1',
        content: '題\n書きかけ',
        mediaUrls: ['p/1.jpg'],
        inlinePaths: ['p/1.jpg'],
        savedContent: '題\n',
      }),
    );
    expect(readEntryLocalCopy('e1')).toBeNull();
    act(() => vi.advanceTimersByTime(300));
    const copy = readEntryLocalCopy('e1');
    expect(copy?.content).toBe('題\n書きかけ');
    expect(copy?.mediaUrls).toEqual(['p/1.jpg']);
    expect(copy?.inlinePaths).toEqual(['p/1.jpg']);
    expect(typeof copy?.updatedAt).toBe('number');
  });

  it('サーバーと同じ内容になったら写しを消す', () => {
    const { rerender } = renderHook(
      ({ content, savedContent }) =>
        useEntryLocalCopy({ entryId: 'e1', content, mediaUrls: [], inlinePaths: [], savedContent }),
      { initialProps: { content: 'a', savedContent: '' } },
    );
    act(() => vi.advanceTimersByTime(300));
    expect(readEntryLocalCopy('e1')).not.toBeNull();
    rerender({ content: 'a', savedContent: 'a' });
    expect(readEntryLocalCopy('e1')).toBeNull();
  });

  it('id が無い間は何も置かない', () => {
    renderHook(() =>
      useEntryLocalCopy({
        entryId: undefined,
        content: 'a',
        mediaUrls: [],
        inlinePaths: [],
        savedContent: '',
      }),
    );
    act(() => vi.advanceTimersByTime(300));
    expect(window.localStorage.length).toBe(0);
  });

  it('pagehide では待たずに写す', () => {
    renderHook(() =>
      useEntryLocalCopy({
        entryId: 'e2',
        content: '途中',
        mediaUrls: [],
        inlinePaths: [],
        savedContent: '',
      }),
    );
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(readEntryLocalCopy('e2')?.content).toBe('途中');
  });

  it('壊れた写しは読まずに捨てる', () => {
    window.localStorage.setItem('oryzae:entry-copy:e3', '{"content": 1}');
    expect(readEntryLocalCopy('e3')).toBeNull();
    expect(window.localStorage.getItem('oryzae:entry-copy:e3')).toBeNull();
    clearEntryLocalCopy('e3');
  });
});
