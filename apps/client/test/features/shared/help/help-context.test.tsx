import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HelpProvider, useHelpMode } from '@/features/shared/help/help-context';
import type { ApiClient } from '@/lib/api';
import { mockResponse } from '../../../helpers/response';

function createApiStub(
  onboardingCompleted: boolean,
): ApiClient & { fetch: ReturnType<typeof vi.fn> } {
  const fetch = vi.fn(async (path: string) => {
    if (path === '/api/v1/users/me') return mockResponse(true, { onboardingCompleted });
    return mockResponse(true, { onboardingCompleted: true });
  });
  return { baseUrl: '', headers: {}, fetch };
}

function wrapperWith(api: ApiClient | null) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <HelpProvider api={api}>{children}</HelpProvider>;
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('HelpProvider', () => {
  it('Provider の外では閉じたままで、何をしても変わらない', () => {
    const { result } = renderHook(() => useHelpMode());
    expect(result.current.open).toBe(false);
    act(() => result.current.toggleHelp());
    expect(result.current.open).toBe(false);
  });

  it('開閉できて、開いたことを憶える', () => {
    const { result } = renderHook(() => useHelpMode(), { wrapper: wrapperWith(null) });
    expect(result.current.open).toBe(false);
    act(() => result.current.toggleHelp());
    expect(result.current.open).toBe(true);
    expect(window.localStorage.getItem('oryzae-help-open')).toBe('1');
    act(() => result.current.closeHelp());
    expect(result.current.open).toBe(false);
    expect(window.localStorage.getItem('oryzae-help-open')).toBe('0');
  });

  it('憶えていれば、次のマウントでも開いている', () => {
    window.localStorage.setItem('oryzae-help-open', '1');
    const { result } = renderHook(() => useHelpMode(), { wrapper: wrapperWith(null) });
    expect(result.current.open).toBe(true);
  });

  it('話題を指定して開くと、それが開いた状態になる', () => {
    const { result } = renderHook(() => useHelpMode(), { wrapper: wrapperWith(null) });
    act(() => result.current.openHelp('jar'));
    expect(result.current.open).toBe(true);
    expect(result.current.focused).toBe('jar');
  });

  it('`?` で開閉、Esc で閉じる。入力欄で打った `?` は効かない', () => {
    const { result } = renderHook(() => useHelpMode(), { wrapper: wrapperWith(null) });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    });
    expect(result.current.open).toBe(true);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.open).toBe(false);

    const input = document.createElement('input');
    document.body.appendChild(input);
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
    });
    expect(result.current.open).toBe(false);
  });

  it('初めての人には自動で開き、最初の話題が開いている。閉じたら記録する', async () => {
    const api = createApiStub(false);
    const { result } = renderHook(() => useHelpMode(), { wrapper: wrapperWith(api) });
    await waitFor(() => {
      expect(result.current.open).toBe(true);
    });
    expect(result.current.firstVisit).toBe(true);
    expect(result.current.focused).toBe('concept');

    act(() => result.current.closeHelp());
    expect(result.current.firstVisit).toBe(false);
    await waitFor(() => {
      expect(api.fetch).toHaveBeenCalledWith('/api/v1/users/me/onboarding', {
        method: 'PATCH',
        body: JSON.stringify({ completed: true }),
      });
    });
  });

  it('見たことがある人には自動で開かない', async () => {
    const api = createApiStub(true);
    const { result } = renderHook(() => useHelpMode(), { wrapper: wrapperWith(api) });
    await waitFor(() => {
      expect(api.fetch).toHaveBeenCalledWith('/api/v1/users/me');
    });
    expect(result.current.open).toBe(false);
    expect(result.current.firstVisit).toBe(false);
  });

  it('開いている間、触れた部品の data-help を読む。隙間に出たら少し待って消す', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useHelpMode(), { wrapper: wrapperWith(null) });
    const jar = document.createElement('button');
    jar.setAttribute('data-help', 'jar');
    const gap = document.createElement('p');
    document.body.append(jar, gap);

    // 閉じている間は読まない。
    act(() => {
      jar.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    });
    expect(result.current.hoverTarget).toBeNull();

    act(() => result.current.openHelp());
    act(() => {
      jar.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    });
    expect(result.current.hoverTarget).toEqual({ topic: 'jar', label: null });

    act(() => {
      gap.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    });
    // まだ消えない（隙間を横切っているだけかもしれない）。
    expect(result.current.hoverTarget).toEqual({ topic: 'jar', label: null });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.hoverTarget).toBeNull();
  });

  it('書斎の的（DOM を持たない）からも「触れている」を伝えられる', () => {
    const { result } = renderHook(() => useHelpMode(), { wrapper: wrapperWith(null) });
    act(() => result.current.setHovered('notebook'));
    expect(result.current.hoverTarget).toEqual({ topic: 'notebook', label: null });
    act(() => result.current.setHovered(null));
    expect(result.current.hoverTarget).toBeNull();
  });
});
