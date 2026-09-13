import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDelayedTrue } from '@/lib/use-delayed';

describe('useDelayedTrue（読み込み中の枠を出すまでの猶予）', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('flag=true になっても猶予（150ms）の間は false のまま', () => {
    const { result, rerender } = renderHook(({ flag }) => useDelayedTrue(flag), {
      initialProps: { flag: false },
    });
    expect(result.current).toBe(false);

    rerender({ flag: true });
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(149));
    expect(result.current).toBe(false);
  });

  it('猶予を過ぎて flag が続いていれば true', () => {
    const { result } = renderHook(() => useDelayedTrue(true));
    act(() => vi.advanceTimersByTime(150));
    expect(result.current).toBe(true);
  });

  it('猶予の中で flag が false に戻れば一度も true にならない（一瞬で返る取得は枠を出さない）', () => {
    const { result, rerender } = renderHook(({ flag }) => useDelayedTrue(flag), {
      initialProps: { flag: true },
    });
    act(() => vi.advanceTimersByTime(80));
    rerender({ flag: false });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe(false);
  });

  it('true になったあと flag が false に戻れば即 false（枠は待たせずに消す）', () => {
    const { result, rerender } = renderHook(({ flag }) => useDelayedTrue(flag), {
      initialProps: { flag: true },
    });
    act(() => vi.advanceTimersByTime(150));
    expect(result.current).toBe(true);
    rerender({ flag: false });
    expect(result.current).toBe(false);
  });

  it('猶予は引数で変えられる', () => {
    const { result } = renderHook(() => useDelayedTrue(true, 30));
    act(() => vi.advanceTimersByTime(29));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });
});
