import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVisualViewport } from '@/lib/visual-viewport';

/**
 * iOS Safari の visualViewport を模す。キーボードが出ると height が縮み、offsetTop が動く。
 * window.innerHeight（レイアウトビューポート）は変わらない。
 */
class FakeVisualViewport extends EventTarget {
  height = 844;
  offsetTop = 0;
}

function defineVisualViewport(viewport: FakeVisualViewport | undefined) {
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: viewport,
  });
}

describe('useVisualViewport（ビジュアルビューポートに追従する）', () => {
  let viewport: FakeVisualViewport;
  let frames: FrameRequestCallback[];

  beforeEach(() => {
    viewport = new FakeVisualViewport();
    defineVisualViewport(viewport);
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    // 1 フレームにまとめる rAF を手で回す
    frames = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    defineVisualViewport(undefined);
    document.body.innerHTML = '';
  });

  function flushFrame() {
    const pending = frames.splice(0);
    act(() => {
      for (const cb of pending) cb(0);
    });
  }

  it('測れるまでは null、測れたら高さと位置（キーボードなし）', () => {
    const { result } = renderHook(() => useVisualViewport());
    expect(result.current).toBeNull();
    flushFrame();
    expect(result.current).toEqual({ top: 0, height: 844, keyboardOpen: false });
  });

  it('キーボードで 120px 以上縮めば keyboardOpen=true、offsetTop も追従する', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();
    const { result } = renderHook(() => useVisualViewport());
    flushFrame();

    viewport.height = 500;
    viewport.offsetTop = 40;
    act(() => {
      viewport.dispatchEvent(new Event('resize'));
    });
    flushFrame();
    expect(result.current).toEqual({ top: 40, height: 500, keyboardOpen: true });
  });

  it('キーボードほど縮んだまま文字を打つ所にフォーカスが無ければ、閉じたあとの古い値として全高に戻す', () => {
    // iOS は写真の選択でキーボードを閉じたとき、ビジュアルビューポートの高さを戻さないことがある。
    // そのまま殻を縮めると、写真の取り込みシートが画面の上のほうに浮いた（レビュー）。
    const { result } = renderHook(() => useVisualViewport());
    flushFrame();
    viewport.height = 500;
    viewport.offsetTop = 40;
    act(() => {
      document.dispatchEvent(new Event('focusout'));
    });
    flushFrame();
    expect(result.current).toEqual({ top: 0, height: 844, keyboardOpen: false });
  });

  it('ツールバーの出入り程度（120px 未満）はキーボードとみなさない', () => {
    const { result } = renderHook(() => useVisualViewport());
    flushFrame();

    viewport.height = 760;
    act(() => {
      viewport.dispatchEvent(new Event('resize'));
    });
    flushFrame();
    expect(result.current?.keyboardOpen).toBe(false);
    expect(result.current?.height).toBe(760);
  });

  it('連続する resize / scroll は 1 フレームにまとめる（setState は最後の 1 回）', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();
    const { result } = renderHook(() => useVisualViewport());
    flushFrame();

    viewport.height = 600;
    act(() => {
      viewport.dispatchEvent(new Event('resize'));
      viewport.dispatchEvent(new Event('scroll'));
      viewport.dispatchEvent(new Event('resize'));
    });
    // 3 回来ても、直前の frame は cancel されて登録が 3 本、実行時にはどれも同じ最新値を読む
    expect(frames.length).toBe(3);
    flushFrame();
    expect(result.current?.height).toBe(600);
  });

  it('visualViewport が無いブラウザでは innerHeight を高さにする', () => {
    defineVisualViewport(undefined);
    const { result } = renderHook(() => useVisualViewport());
    flushFrame();
    expect(result.current).toEqual({ top: 0, height: 844, keyboardOpen: false });
  });

  it('外れたら listener を外す', () => {
    const remove = vi.spyOn(viewport, 'removeEventListener');
    const { unmount } = renderHook(() => useVisualViewport());
    unmount();
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
    // フォーカスの出入りの listener も残さない。
    const removeDocument = vi.spyOn(document, 'removeEventListener');
    const second = renderHook(() => useVisualViewport());
    second.unmount();
    expect(removeDocument).toHaveBeenCalledWith('focusout', expect.any(Function));
  });
});
