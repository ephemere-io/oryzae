import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFocusMode } from '@/features/entries/hooks/use-focus-mode';

function dispatchMouseMove() {
  document.dispatchEvent(new MouseEvent('mousemove'));
}

function dispatchInput(target: HTMLElement) {
  target.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('useFocusMode', () => {
  let editorEl: HTMLDivElement;
  let editorRef: { current: HTMLDivElement | null };

  beforeEach(() => {
    editorEl = document.createElement('div');
    document.body.appendChild(editorEl);
    editorRef = { current: editorEl };
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    editorEl.remove();
  });

  it('starts visible', () => {
    const { result } = renderHook(() =>
      useFocusMode({ enabled: true, forceVisible: false, editorRef }),
    );
    expect(result.current).toBe(true);
  });

  it('stays visible when disabled even on input', () => {
    const { result } = renderHook(() =>
      useFocusMode({ enabled: false, forceVisible: false, editorRef }),
    );
    act(() => {
      dispatchInput(editorEl);
    });
    expect(result.current).toBe(true);
  });

  it('stays visible when forceVisible is true', () => {
    const { result } = renderHook(() =>
      useFocusMode({ enabled: true, forceVisible: true, editorRef }),
    );
    act(() => {
      dispatchInput(editorEl);
    });
    expect(result.current).toBe(true);
  });

  it('hides immediately on input when no recent mouse movement', () => {
    const { result } = renderHook(() =>
      useFocusMode({ enabled: true, forceVisible: false, editorRef }),
    );
    act(() => {
      dispatchInput(editorEl);
    });
    expect(result.current).toBe(false);
  });

  it('shows on mousemove', () => {
    const { result } = renderHook(() =>
      useFocusMode({ enabled: true, forceVisible: false, editorRef }),
    );
    act(() => {
      dispatchInput(editorEl);
    });
    expect(result.current).toBe(false);
    act(() => {
      dispatchMouseMove();
    });
    expect(result.current).toBe(true);
  });

  it('delays hide by 2s after recent mouse movement', () => {
    const { result } = renderHook(() =>
      useFocusMode({ enabled: true, forceVisible: false, editorRef }),
    );
    act(() => {
      dispatchMouseMove();
    });
    act(() => {
      dispatchInput(editorEl);
    });
    expect(result.current).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(result.current).toBe(true);
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(result.current).toBe(false);
  });

  it('mousemove during grace period resets visibility and cancels hide', () => {
    const { result } = renderHook(() =>
      useFocusMode({ enabled: true, forceVisible: false, editorRef }),
    );
    act(() => {
      dispatchMouseMove();
    });
    act(() => {
      dispatchInput(editorEl);
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      dispatchMouseMove();
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current).toBe(true);
  });

  it('removes listeners on cleanup', () => {
    const removeDocSpy = vi.spyOn(document, 'removeEventListener');
    const removeEditorSpy = vi.spyOn(editorEl, 'removeEventListener');
    const { unmount } = renderHook(() =>
      useFocusMode({ enabled: true, forceVisible: false, editorRef }),
    );
    unmount();
    expect(removeDocSpy.mock.calls.map((c) => c[0])).toContain('mousemove');
    expect(removeEditorSpy.mock.calls.map((c) => c[0])).toContain('input');
  });

  it('forces visible again when forceVisible toggles on', () => {
    const { result, rerender } = renderHook(
      ({ forceVisible }: { forceVisible: boolean }) =>
        useFocusMode({ enabled: true, forceVisible, editorRef }),
      { initialProps: { forceVisible: false } },
    );
    act(() => {
      dispatchInput(editorEl);
    });
    expect(result.current).toBe(false);
    rerender({ forceVisible: true });
    expect(result.current).toBe(true);
  });
});
