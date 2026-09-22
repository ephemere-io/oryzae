import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HELP_WIDTH, HelpProvider, useHelpMode } from '@/features/shared/help/help-context';
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

function pressKey(key: string, target: EventTarget = window) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  // 前のテストの Provider が残っていると、window の `?` を拾って localStorage を書き戻す。
  cleanup();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('HelpProvider', () => {
  it('Provider の外では無効・閉じたままで、何をしても変わらない', () => {
    const { result } = renderHook(() => useHelpMode());
    expect(result.current.enabled).toBe(false);
    expect(result.current.open).toBe(false);
    act(() => result.current.toggleHelp());
    expect(result.current.open).toBe(false);
  });

  it('既定で有効。開閉できて、開いたことを憶える', () => {
    const { result } = renderHook(() => useHelpMode(), { wrapper: wrapperWith(null) });
    expect(result.current.enabled).toBe(true);
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

  it('設定で切ると閉じ、`?` でも開かず、次のマウントでも切れたまま', () => {
    const { result } = renderHook(() => useHelpMode(), { wrapper: wrapperWith(null) });
    act(() => result.current.openHelp());
    act(() => result.current.setEnabled(false));
    expect(result.current.enabled).toBe(false);
    expect(result.current.open).toBe(false);
    pressKey('?');
    expect(result.current.open).toBe(false);
    expect(window.localStorage.getItem('oryzae-help-mode')).toBe('0');

    const again = renderHook(() => useHelpMode(), { wrapper: wrapperWith(null) });
    expect(again.result.current.enabled).toBe(false);
  });

  it('切っていても「開け」と言われたら有効にして開く（設定の外からの入口）', () => {
    window.localStorage.setItem('oryzae-help-mode', '0');
    const { result } = renderHook(() => useHelpMode(), { wrapper: wrapperWith(null) });
    expect(result.current.enabled).toBe(false);
    act(() => result.current.openHelp('jar'));
    expect(result.current.enabled).toBe(true);
    expect(result.current.open).toBe(true);
    expect(result.current.focused).toBe('jar');
  });

  it('幅は範囲に収めて憶え、次のマウントで戻る', () => {
    const { result } = renderHook(() => useHelpMode(), { wrapper: wrapperWith(null) });
    expect(result.current.width).toBe(HELP_WIDTH.default);
    act(() => result.current.setWidth(420));
    expect(result.current.width).toBe(420);
    act(() => result.current.setWidth(10));
    expect(result.current.width).toBe(HELP_WIDTH.min);
    act(() => result.current.setWidth(9999));
    expect(result.current.width).toBe(HELP_WIDTH.max);
    expect(window.localStorage.getItem('oryzae-help-width')).toBe(String(HELP_WIDTH.max));

    const again = renderHook(() => useHelpMode(), { wrapper: wrapperWith(null) });
    expect(again.result.current.width).toBe(HELP_WIDTH.max);
  });

  it('`?` で開閉、Esc で閉じる。入力欄で打った `?` は効かない', () => {
    const { result } = renderHook(() => useHelpMode(), { wrapper: wrapperWith(null) });
    pressKey('?');
    expect(result.current.open).toBe(true);
    pressKey('Escape');
    expect(result.current.open).toBe(false);

    const input = document.createElement('input');
    document.body.appendChild(input);
    pressKey('?', input);
    expect(result.current.open).toBe(false);
  });

  it('初めての人には開いた状態で始まり、閉じたら「?」が居場所を教え、記録する', async () => {
    const api = createApiStub(false);
    const { result } = renderHook(() => useHelpMode(), { wrapper: wrapperWith(api) });
    await waitFor(() => {
      expect(result.current.open).toBe(true);
    });
    expect(result.current.firstVisit).toBe(true);
    expect(result.current.cue).toBe(false);

    act(() => result.current.closeHelp());
    expect(result.current.open).toBe(false);
    expect(result.current.firstVisit).toBe(false);
    expect(result.current.cue).toBe(true);
    await waitFor(() => {
      expect(api.fetch).toHaveBeenCalledWith('/api/v1/users/me/onboarding', {
        method: 'PATCH',
        body: JSON.stringify({ completed: true }),
      });
    });

    // もう一度開けば、教え終わり。
    act(() => result.current.openHelp());
    expect(result.current.cue).toBe(false);
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

  it('面の中に入ったら「触れていない」に戻る（隣の物の説明が居座らない）', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useHelpMode(), { wrapper: wrapperWith(null) });
    const link = document.createElement('a');
    link.setAttribute('data-help', 'questions');
    const panel = document.createElement('aside');
    panel.setAttribute('data-help-panel', '');
    const inside = document.createElement('button');
    panel.appendChild(inside);
    document.body.append(link, panel);

    act(() => result.current.openHelp());
    act(() => {
      link.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    });
    expect(result.current.hoverTarget).toEqual({ topic: 'questions', label: null });
    // 隙間を飛ばして面の中へ（速く動かすと隙間で pointerover が起きない）。
    act(() => {
      inside.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    });
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
