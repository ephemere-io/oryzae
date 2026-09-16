import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  hiddenBottomHeight,
  watchHiddenBottomHeight,
} from '@/features/shared/auth/entrance/viewport';

/**
 * 下に隠れている高さは **実測**（`visualViewport`）で出す。
 *
 * 決め打ちの割合をやめた理由は `viewport.ts` の注釈のとおり。ここでは
 * 「重なっているブラウザ」「よけるブラウザ」「教えてくれない環境」を作って確かめる。
 */

/** `visualViewport` を差し替える。返り値で resize を起こせる。 */
function stubVisualViewport(height: number, offsetTop = 0) {
  const listeners = new Map<string, Set<() => void>>();
  const viewport = {
    height,
    offsetTop,
    addEventListener: (type: string, handler: () => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)?.add(handler);
    },
    removeEventListener: (type: string, handler: () => void) => {
      listeners.get(type)?.delete(handler);
    },
  };
  vi.stubGlobal('visualViewport', viewport);
  Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true });
  return {
    resize(next: number) {
      viewport.height = next;
      for (const handler of listeners.get('resize') ?? []) handler();
    },
    listenerCount: () =>
      (listeners.get('resize')?.size ?? 0) + (listeners.get('scroll')?.size ?? 0),
  };
}

function setInnerHeight(height: number): void {
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
}

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true });
  document.body.innerHTML = '';
});

describe('hiddenBottomHeight', () => {
  it('ツールバーが重なっているぶんを、見えている領域との差で出す', () => {
    // 画面いっぱい（852）に描いていて、見えているのは 776 = ツールバー 76 が重なっている。
    setInnerHeight(852);
    stubVisualViewport(776);

    expect(hiddenBottomHeight()).toBe(76);
  });

  it('ブラウザが自分でよけているなら 0（Safari など）', () => {
    setInnerHeight(750);
    stubVisualViewport(750);

    expect(hiddenBottomHeight()).toBe(0);
  });

  it('表示領域が上へずれている（拡大）ぶんも下に隠れる', () => {
    setInnerHeight(852);
    stubVisualViewport(700, 40);

    expect(hiddenBottomHeight()).toBe(112);
  });

  it('`visualViewport` が無い環境では 0（何も足さない）', () => {
    setInnerHeight(852);

    expect(hiddenBottomHeight()).toBe(0);
  });
});

describe('watchHiddenBottomHeight', () => {
  it('すぐ 1 回知らせ、表示領域が変わるたびに知らせる', () => {
    setInnerHeight(852);
    const viewport = stubVisualViewport(852);
    const seen: number[] = [];

    const stop = watchHiddenBottomHeight((height) => seen.push(height));
    expect(seen).toEqual([0]);

    viewport.resize(776);
    expect(seen).toEqual([0, 76]);

    stop();
    expect(viewport.listenerCount()).toBe(0);
  });

  it('入力中（キーボードが出ている間）は更新しない', () => {
    setInnerHeight(852);
    const viewport = stubVisualViewport(852);
    const input = document.createElement('input');
    document.body.append(input);
    const seen: number[] = [];
    const stop = watchHiddenBottomHeight((height) => seen.push(height));

    input.focus();
    // キーボードが出て表示領域が大きく縮む。ここで紙を持ち上げると二重に動く。
    viewport.resize(420);

    expect(seen).toEqual([0]);
    stop();
  });
});
