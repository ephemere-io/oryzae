import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBrowserNavGuard } from '@/features/entries/hooks/use-browser-nav-guard';

describe('useBrowserNavGuard', () => {
  beforeEach(() => {
    vi.spyOn(window.history, 'pushState');
    vi.spyOn(window.history, 'go').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('pushes a sentinel history entry when enabled', () => {
    renderHook(() => useBrowserNavGuard(true));
    expect(window.history.pushState).toHaveBeenCalledWith(null, '', window.location.href);
  });

  it('does not push a sentinel when disabled', () => {
    renderHook(() => useBrowserNavGuard(false));
    expect(window.history.pushState).not.toHaveBeenCalled();
  });

  it('opens the modal and re-pushes the sentinel on popstate', () => {
    const { result } = renderHook(() => useBrowserNavGuard(true));
    expect(result.current.open).toBe(false);

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(result.current.open).toBe(true);
    // pushState called once on mount + once on popstate
    expect(window.history.pushState).toHaveBeenCalledTimes(2);
  });

  it('cancel closes the modal without navigating', () => {
    const { result } = renderHook(() => useBrowserNavGuard(true));

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current.open).toBe(true);

    act(() => {
      result.current.cancel();
    });
    expect(result.current.open).toBe(false);
    expect(window.history.go).not.toHaveBeenCalled();
  });

  it('confirm closes the modal and navigates back past the sentinel', () => {
    const { result } = renderHook(() => useBrowserNavGuard(true));

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    act(() => {
      result.current.confirm();
    });

    expect(result.current.open).toBe(false);
    expect(window.history.go).toHaveBeenCalledWith(-2);
  });

  it('skips interception on the popstate fired by confirm()', () => {
    const { result } = renderHook(() => useBrowserNavGuard(true));

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    act(() => {
      result.current.confirm();
    });

    const pushCallsBefore = (window.history.pushState as ReturnType<typeof vi.fn>).mock.calls
      .length;

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    const pushCallsAfter = (window.history.pushState as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(pushCallsAfter).toBe(pushCallsBefore);
    expect(result.current.open).toBe(false);
  });

  it('removes the popstate listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useBrowserNavGuard(true));
    unmount();
    const removed = removeSpy.mock.calls.map((c) => c[0]);
    expect(removed).toContain('popstate');
  });
});
