import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useElementResize } from '@/lib/use-element-resize';

/** jsdom には ResizeObserver が無いので、必要なテストだけ差し込む。 */
function installResizeObserver() {
  const observed: Element[] = [];
  const disconnect = vi.fn();
  let fire: (() => void) | null = null;

  class FakeResizeObserver {
    constructor(callback: () => void) {
      fire = callback;
    }
    observe(el: Element) {
      observed.push(el);
    }
    disconnect() {
      disconnect();
    }
    unobserve() {}
  }

  // @type-assertion-allowed: テスト用の最小 ResizeObserver スタブ（globalThis へ差し込む）
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = FakeResizeObserver;

  return { observed, disconnect, trigger: () => fire?.() };
}

function removeResizeObserver() {
  // 素の jsdom には無いプロパティなので、消して元に戻す（キャストが要らない）。
  Reflect.deleteProperty(globalThis, 'ResizeObserver');
}

afterEach(() => {
  removeResizeObserver();
  vi.restoreAllMocks();
});

describe('useElementResize', () => {
  it('element が null なら何も張らない', () => {
    const onResize = vi.fn();
    const spy = vi.spyOn(window, 'addEventListener');
    renderHook(() => useElementResize(null, onResize));
    expect(onResize).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalledWith('resize', expect.anything());
  });

  it('ResizeObserver があれば要素を監視し、通知を伝える', () => {
    const ro = installResizeObserver();
    const el = document.createElement('div');
    const onResize = vi.fn();

    renderHook(() => useElementResize(el, onResize));

    expect(ro.observed).toEqual([el]);
    ro.trigger();
    expect(onResize).toHaveBeenCalledTimes(1);
  });

  it('アンマウントで監視を解く', () => {
    const ro = installResizeObserver();
    const { unmount } = renderHook(() => useElementResize(document.createElement('div'), vi.fn()));
    unmount();
    expect(ro.disconnect).toHaveBeenCalledTimes(1);
  });

  it('最新のコールバックを呼ぶ（毎レンダー張り直さない）', () => {
    const ro = installResizeObserver();
    const el = document.createElement('div');
    const first = vi.fn();
    const second = vi.fn();

    const { rerender } = renderHook(({ cb }: { cb: () => void }) => useElementResize(el, cb), {
      initialProps: { cb: first },
    });
    rerender({ cb: second });

    ro.trigger();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    // 監視は張り直されていない（要素は 1 回だけ observe される）。
    expect(ro.observed).toEqual([el]);
  });

  it('ResizeObserver が無い環境では window の resize に落ちる（jsdom・検証ハーネス）', () => {
    // installResizeObserver を呼ばない ＝ 素の jsdom。
    const onResize = vi.fn();
    const { unmount } = renderHook(() => useElementResize(document.createElement('div'), onResize));

    // ここで throw しないことが要点（素で new すると ReferenceError で落ちていた）。
    window.dispatchEvent(new Event('resize'));
    expect(onResize).toHaveBeenCalledTimes(1);

    unmount();
    window.dispatchEvent(new Event('resize'));
    expect(onResize).toHaveBeenCalledTimes(1);
  });
});
