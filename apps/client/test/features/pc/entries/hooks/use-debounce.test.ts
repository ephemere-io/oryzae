import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebounce } from '@/features/pc/entries/hooks/use-debounce';

/**
 * characterization test（#434 リファクタ前の現挙動固定）。
 * use-debounce は lib/ へ移設予定。移設後も同一アサーションが通ることで挙動不変を保証する。
 */
describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('初期値を即座に返す', () => {
    const { result } = renderHook(() => useDebounce('a', 300));
    expect(result.current).toBe('a');
  });

  it('delay 経過後に最新値へ更新する', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), {
      initialProps: { v: 'a' },
    });

    rerender({ v: 'b' });
    expect(result.current).toBe('a'); // まだ delay 未達

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe('b');
  });

  it('delay 内の連続変更では前のタイマーを解除し、最後の値だけ反映する', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), {
      initialProps: { v: 'a' },
    });

    rerender({ v: 'b' });
    act(() => {
      vi.advanceTimersByTime(200); // b のタイマー進行中
    });
    rerender({ v: 'c' }); // b のタイマー解除、c のタイマー開始

    act(() => {
      vi.advanceTimersByTime(200); // c から 200ms（300ms 未達）
    });
    expect(result.current).toBe('a'); // b は破棄され、c もまだ

    act(() => {
      vi.advanceTimersByTime(100); // c から通算 300ms
    });
    expect(result.current).toBe('c');
  });
});
