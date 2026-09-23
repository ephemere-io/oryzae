import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HELP_WIDTH, HelpProvider, useHelpMode } from '@/features/shared/help/help-context';
import { notifyActivity } from '@/lib/activity';
import type { ApiClient } from '@/lib/api';
import { mockResponse } from '../../../helpers/response';

// Provider は画面を移ったら「触れていない」に戻すので、いまの画面を差し替えられるようにする。
const nav = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

function createApiStub(
  onboardingCompleted: boolean,
): ApiClient & { fetch: ReturnType<typeof vi.fn> } {
  const fetch = vi.fn(async (path: string) => {
    if (path === '/api/v1/users/me') return mockResponse(true, { onboardingCompleted });
    return mockResponse(true, { onboardingCompleted: true });
  });
  return { baseUrl: '', headers: {}, fetch };
}

interface Flags {
  onboardingCompleted: boolean;
  hasQuestion?: boolean;
  hasLinkedQuestion?: boolean;
  hasPickled?: boolean;
}

/** users/me の旗を後から書き換えられる stub（成し遂げた合図で取り直すのを見る）。 */
function createApiStubWith(flags: Flags): ApiClient & { fetch: ReturnType<typeof vi.fn> } {
  const fetch = vi.fn(async (path: string) => {
    if (path === '/api/v1/users/me') return mockResponse(true, { ...flags });
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
  nav.pathname = '/';
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

  it('変換中の Esc と、検索欄が自分で処理した Esc では閉じない', () => {
    const { result } = renderHook(() => useHelpMode(), { wrapper: wrapperWith(null) });
    act(() => result.current.openHelp());
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true }),
      );
    });
    expect(result.current.open).toBe(true);
    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      event.preventDefault();
      window.dispatchEvent(event);
    });
    expect(result.current.open).toBe(true);
    pressKey('Escape');
    expect(result.current.open).toBe(false);
  });

  it('面の外で字を打っている最中や、手前にメニューがあるときの Esc では閉じない。面の中からは閉じる', () => {
    const { result } = renderHook(() => useHelpMode(), { wrapper: wrapperWith(null) });
    act(() => result.current.openHelp());
    const editor = document.createElement('input');
    document.body.appendChild(editor);
    pressKey('Escape', editor);
    expect(result.current.open).toBe(true);

    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    document.body.appendChild(menu);
    pressKey('Escape');
    expect(result.current.open).toBe(true);
    menu.remove();

    const panel = document.createElement('div');
    panel.setAttribute('data-help-panel', '');
    const search = document.createElement('input');
    panel.appendChild(search);
    document.body.appendChild(panel);
    pressKey('Escape', search);
    expect(result.current.open).toBe(false);
  });

  it('閉じている間は、触れているものを憶えない', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useHelpMode(), { wrapper: wrapperWith(null) });
    act(() => {
      result.current.setHovered('jar');
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.hoverTarget).toBeNull();
    act(() => result.current.openHelp());
    act(() => {
      result.current.setHovered('jar');
      vi.advanceTimersByTime(500);
    });
    expect(result.current.hoverTarget?.topic).toBe('jar');
  });

  it('「始めてみよう」で記録する。面は開いたまま、初めて閉じたときの脈打ちは残り、二度は送らない', async () => {
    const api = createApiStub(false);
    const { result } = renderHook(() => useHelpMode(), { wrapper: wrapperWith(api) });
    await waitFor(() => {
      expect(result.current.welcome).toBe(true);
    });
    const patches = () =>
      api.fetch.mock.calls.filter((call) => call[0] === '/api/v1/users/me/onboarding').length;
    expect(patches()).toBe(0);
    act(() => result.current.dismissWelcome());
    expect(result.current.welcome).toBe(false);
    expect(result.current.open).toBe(true);
    expect(patches()).toBe(1);
    act(() => result.current.closeHelp());
    expect(result.current.cue).toBe(true);
    expect(patches()).toBe(1);
  });

  it('初めての人が × の前に設定で切ったら、記録して、次の読み込みでは開かず設定も戻さない', async () => {
    const api = createApiStub(false);
    const first = renderHook(() => useHelpMode(), { wrapper: wrapperWith(api) });
    await waitFor(() => {
      expect(first.result.current.open).toBe(true);
    });
    act(() => first.result.current.setEnabled(false));
    expect(first.result.current.enabled).toBe(false);
    expect(first.result.current.open).toBe(false);
    expect(api.fetch).toHaveBeenCalledWith(
      '/api/v1/users/me/onboarding',
      expect.objectContaining({ method: 'PATCH' }),
    );
    cleanup();

    // 次の読み込み。サーバーがまだ false と言っても、切った設定はそのまま、開かない。
    const api2 = createApiStub(false);
    const again = renderHook(() => useHelpMode(), { wrapper: wrapperWith(api2) });
    await waitFor(() => {
      expect(api2.fetch).toHaveBeenCalledWith('/api/v1/users/me/onboarding', expect.anything());
    });
    expect(again.result.current.enabled).toBe(false);
    expect(again.result.current.open).toBe(false);
    expect(window.localStorage.getItem('oryzae-help-mode')).toBe('0');
  });

  it('初めての人には開いた状態で始まり、閉じたら「?」が居場所を教え、記録する', async () => {
    const api = createApiStub(false);
    const { result } = renderHook(() => useHelpMode(), { wrapper: wrapperWith(api) });
    await waitFor(() => {
      expect(result.current.open).toBe(true);
    });
    expect(result.current.firstVisit).toBe(true);
    expect(result.current.cue).toBe(false);
    // 面以外を沈めて「ようこそ」。晴らしても面はそのまま。
    expect(result.current.welcome).toBe(true);
    act(() => result.current.dismissWelcome());
    expect(result.current.welcome).toBe(false);
    expect(result.current.open).toBe(true);

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

  it('見たことがある人には自動で開かず、「ようこそ」も出ない', async () => {
    const api = createApiStub(true);
    const { result } = renderHook(() => useHelpMode(), { wrapper: wrapperWith(api) });
    await waitFor(() => {
      expect(api.fetch).toHaveBeenCalledWith('/api/v1/users/me');
    });
    expect(result.current.open).toBe(false);
    expect(result.current.firstVisit).toBe(false);
    act(() => result.current.openHelp());
    expect(result.current.welcome).toBe(false);
  });

  it('初めての人が「ようこそ」を晴らさずに面を閉じても、「ようこそ」は消える', async () => {
    const api = createApiStub(false);
    const { result } = renderHook(() => useHelpMode(), { wrapper: wrapperWith(api) });
    await waitFor(() => {
      expect(result.current.welcome).toBe(true);
    });
    act(() => result.current.closeHelp());
    expect(result.current.welcome).toBe(false);
    act(() => result.current.openHelp());
    expect(result.current.welcome).toBe(false);
  });

  it('開いている間、触れて少し止まった部品の data-help を映す。隙間に出ても次に止まるまでそのまま', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useHelpMode(), { wrapper: wrapperWith(null) });
    const jar = document.createElement('button');
    jar.setAttribute('data-help', 'jar');
    const gap = document.createElement('p');
    document.body.append(jar, gap);

    // 閉じている間は読まない。
    act(() => {
      jar.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.hoverTarget).toBeNull();

    act(() => result.current.openHelp());
    act(() => {
      jar.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    });
    // 触れた瞬間はまだ変えない（通り過ぎるだけかもしれない）。
    expect(result.current.hoverTarget).toBeNull();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.hoverTarget).toEqual({ topic: 'jar', label: null });

    act(() => {
      gap.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
      vi.advanceTimersByTime(1000);
    });
    // 隙間に出ても消えない — 次に止まるまで、いま映しているものを持つ。
    expect(result.current.hoverTarget).toEqual({ topic: 'jar', label: null });
  });

  it('通り過ぎただけの部品では変えない', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useHelpMode(), { wrapper: wrapperWith(null) });
    const jar = document.createElement('button');
    jar.setAttribute('data-help', 'jar');
    const notebook = document.createElement('button');
    notebook.setAttribute('data-help', 'notebook');
    document.body.append(jar, notebook);
    act(() => result.current.openHelp());
    act(() => {
      jar.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
      vi.advanceTimersByTime(200);
      notebook.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
      vi.advanceTimersByTime(500);
    });
    expect(result.current.hoverTarget).toEqual({ topic: 'notebook', label: null });
  });

  it('画面を移ったら「触れていない」に戻る', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(() => useHelpMode(), { wrapper: wrapperWith(null) });
    const jar = document.createElement('button');
    jar.setAttribute('data-help', 'jar');
    document.body.append(jar);
    act(() => result.current.openHelp());
    act(() => {
      jar.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
      vi.advanceTimersByTime(500);
    });
    expect(result.current.hoverTarget?.topic).toBe('jar');
    nav.pathname = '/jar';
    rerender();
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
      vi.advanceTimersByTime(500);
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

  it('書斎の的（DOM を持たない）からも「触れている」を伝えられる。離れても次まで持つ', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useHelpMode(), { wrapper: wrapperWith(null) });
    act(() => result.current.openHelp());
    act(() => {
      result.current.setHovered('notebook');
      vi.advanceTimersByTime(500);
    });
    expect(result.current.hoverTarget).toEqual({ topic: 'notebook', label: null });
    act(() => {
      result.current.setHovered(null);
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.hoverTarget).toEqual({ topic: 'notebook', label: null });
  });

  it('users/me の旗から「いまの歩」が決まり、開いている間だけ html に印が付く', async () => {
    const api = createApiStubWith({ onboardingCompleted: true, hasQuestion: true });
    const { result } = renderHook(() => useHelpMode(), { wrapper: wrapperWith(api) });
    await waitFor(() => {
      expect(result.current.tutorial.step).toBe('write');
    });
    expect(result.current.tutorial.done).toEqual({ question: true, write: false, pickle: false });
    expect(document.documentElement.getAttribute('data-tutorial-step')).toBeNull();
    act(() => result.current.openHelp());
    expect(document.documentElement.getAttribute('data-tutorial-step')).toBe('write');
    act(() => result.current.closeHelp());
    expect(document.documentElement.getAttribute('data-tutorial-step')).toBeNull();
  });

  it('三歩が全部済んでいれば、いまの歩は無く印も付かない', async () => {
    const api = createApiStubWith({
      onboardingCompleted: true,
      hasQuestion: true,
      hasLinkedQuestion: true,
      hasPickled: true,
    });
    const { result } = renderHook(() => useHelpMode(), { wrapper: wrapperWith(api) });
    await waitFor(() => {
      expect(result.current.tutorial.done?.pickle).toBe(true);
    });
    expect(result.current.tutorial.step).toBeNull();
    act(() => result.current.openHelp());
    expect(document.documentElement.getAttribute('data-tutorial-step')).toBeNull();
  });

  it('成し遂げた合図で次の歩へ進む', async () => {
    const flags: Flags = { onboardingCompleted: true };
    const api = createApiStubWith(flags);
    const { result } = renderHook(() => useHelpMode(), { wrapper: wrapperWith(api) });
    await waitFor(() => {
      expect(result.current.tutorial.step).toBe('question');
    });
    flags.hasQuestion = true;
    act(() => notifyActivity('question'));
    await waitFor(() => {
      expect(result.current.tutorial.step).toBe('write');
    });
  });
});
