import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BoardCardData } from '@/features/shared/board/types';
import { SpBoardSurface } from '@/features/sp/board/components/sp-board-surface';
import type { CanvasSurface } from '@/lib/canvas/use-canvas-viewport';
import { withVerifyProviders } from '@/lib/verify/with-providers';

afterEach(cleanup);

function card(id: string, x = 0, y = 0): BoardCardData {
  return {
    id,
    cardType: 'snippet',
    refId: `s-${id}`,
    x,
    y,
    rotation: 0,
    width: 262,
    height: 120,
    zIndex: 1,
    userPositioned: false,
    createdAt: '2026-09-04T01:00:00.000Z',
    content: { text: 'あ' },
  };
}

/**
 * 盤面（`useCanvasViewport`）の代わり。倍率だけを持たせて、指の移動が world に
 * どう届くかを見る。jsdom では frame の矩形が 0 なので、画面座標をそのまま倍率で割る。
 */
function stubCanvas(scale = 1): CanvasSurface {
  return {
    viewport: { x: 0, y: 0, scale },
    isPanning: false,
    frameRef: () => {},
    worldRef: { current: null },
    toWorld: (clientX: number, clientY: number) => ({ x: clientX / scale, y: clientY / scale }),
    centerWorld: () => ({ x: 0, y: 0 }),
    frameSize: () => ({ width: 390, height: 560 }),
    zoomIn: () => {},
    zoomOut: () => {},
    resetZoom: () => {},
    referenceScale: 1,
    scaleBounds: { min: 0.2, max: 4 },
    fitTo: () => {},
    subscribe: () => () => {},
  };
}

describe('SpBoardSurface', () => {
  function renderSurface(overrides: Partial<React.ComponentProps<typeof SpBoardSurface>> = {}) {
    const props = {
      cards: [card('c1'), card('c2', 300, 200)],
      canvas: stubCanvas(),
      onMove: vi.fn(),
      onCommit: vi.fn(),
      onFit: vi.fn(),
      ...overrides,
    };
    return { ...render(withVerifyProviders(<SpBoardSurface {...props} />)), props };
  }

  it('右ペインを持たない（縦画面で板が潰れる）', () => {
    const { container } = renderSurface();
    expect(
      container
        .querySelector('[data-verify-unit="SpBoardSurface"]')
        ?.getAttribute('data-verify-has-side-pane'),
    ).toBe('false');
  });

  it('カードを枚数ぶん描く', () => {
    const { container } = renderSurface();
    expect(container.querySelectorAll('[data-card-id]')).toHaveLength(2);
  });

  it('削除中のカードは描かない', () => {
    const { container } = renderSurface({
      cards: [card('c1'), { ...card('c2'), removing: true }],
    });
    expect(container.querySelectorAll('[data-card-id]')).toHaveLength(1);
  });

  it('隅に枚数を出し、日付は出さない（ボードは 1 人に 1 枚）', () => {
    const { container } = renderSurface();
    expect(container.textContent).toContain('2');
    expect(container.textContent).not.toMatch(/\d{2}\.\d{2}/);
  });

  it('カードが無いときは文言を出す', () => {
    const { container } = renderSurface({ cards: [] });
    expect(container.querySelector('p')).not.toBeNull();
    expect(container.querySelectorAll('[data-card-id]')).toHaveLength(0);
  });

  it('カードは盤面のパンを辞退する（掴んだらカードが動く）', () => {
    const { container } = renderSurface();
    for (const element of container.querySelectorAll('[data-card-id]')) {
      expect(element.hasAttribute('data-canvas-no-pan')).toBe(true);
    }
  });

  it('指の移動で新しい world 座標を通知する', () => {
    const onMove = vi.fn();
    const { container } = renderSurface({ onMove });
    const target = container.querySelector('[data-card-id="c1"]');
    if (!(target instanceof HTMLElement)) throw new Error('missing card');
    // jsdom は setPointerCapture を持たない。実装側で任意呼び出しにしてある。
    target.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientX: 10, clientY: 10 }));
    target.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 40, clientY: 70 }));

    expect(onMove).toHaveBeenCalledWith('c1', 30, 60);
  });

  it('縮小表示では移動量を倍率で割る', () => {
    const onMove = vi.fn();
    const { container } = renderSurface({ onMove, canvas: stubCanvas(0.5) });
    const target = container.querySelector('[data-card-id="c1"]');
    if (!(target instanceof HTMLElement)) throw new Error('missing card');
    target.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }));
    target.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 50, clientY: 0 }));

    // 画面 50px の移動は、0.5 倍で表示している world では 100px。
    expect(onMove).toHaveBeenCalledWith('c1', 100, 0);
  });

  it('掴んでいない指の移動は無視する', () => {
    const onMove = vi.fn();
    const { container } = renderSurface({ onMove });
    const target = container.querySelector('[data-card-id="c1"]');
    if (!(target instanceof HTMLElement)) throw new Error('missing card');
    target.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 40, clientY: 70 }));
    expect(onMove).not.toHaveBeenCalled();
  });

  it('別の指の移動では動かさない（マルチタッチで暴れない）', () => {
    const onMove = vi.fn();
    const { container } = renderSurface({ onMove });
    const target = container.querySelector('[data-card-id="c1"]');
    if (!(target instanceof HTMLElement)) throw new Error('missing card');
    target.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }));
    target.dispatchEvent(pointerEvent('pointermove', { pointerId: 2, clientX: 80, clientY: 80 }));
    expect(onMove).not.toHaveBeenCalled();
  });

  it('掴んでいる間だけ最前面に上がる', () => {
    const { container } = renderSurface();
    const target = container.querySelector('[data-card-id="c1"]');
    if (!(target instanceof HTMLElement)) throw new Error('missing card');
    expect(Number(target.style.zIndex)).toBeLessThan(1000);

    act(() => {
      target.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }));
    });
    expect(Number(target.style.zIndex)).toBe(1000);

    act(() => {
      target.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientX: 0, clientY: 0 }));
    });
    expect(Number(target.style.zIndex)).toBeLessThan(1000);
  });

  it('動かしてから離すと保存を促す', () => {
    const onCommit = vi.fn();
    const { container } = renderSurface({ onCommit });
    const target = container.querySelector('[data-card-id="c1"]');
    if (!(target instanceof HTMLElement)) throw new Error('missing card');
    target.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }));
    target.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 20, clientY: 20 }));
    target.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientX: 20, clientY: 20 }));
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('動かさずに離したら「選んだ」（保存はしない）', () => {
    // 指はわずかに揺れる。触れただけの操作で 1〜2px ずれた位置を保存しない。
    const onCommit = vi.fn();
    const onSelect = vi.fn();
    const { container } = renderSurface({ onCommit, onSelect });
    const target = container.querySelector('[data-card-id="c1"]');
    if (!(target instanceof HTMLElement)) throw new Error('missing card');
    target.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }));
    target.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 2, clientY: 1 }));
    target.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientX: 2, clientY: 1 }));
    expect(onSelect).toHaveBeenCalledWith('c1');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('タップしたカードを前面へ出す（重なった下のカードを掘り出せる）', () => {
    const onRaise = vi.fn();
    const onSelect = vi.fn();
    const { container } = renderSurface({ onRaise, onSelect });
    const target = container.querySelector('[data-card-id="c1"]');
    if (!(target instanceof HTMLElement)) throw new Error('missing card');

    target.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }));
    target.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientX: 0, clientY: 0 }));

    expect(onSelect).toHaveBeenCalledWith('c1');
    expect(onRaise).toHaveBeenCalledWith('c1');
  });

  it('掴んで運んだときは前面へ出さない（位置の保存だけ）', () => {
    const onRaise = vi.fn();
    const onCommit = vi.fn();
    const { container } = renderSurface({ onRaise, onCommit });
    const target = container.querySelector('[data-card-id="c1"]');
    if (!(target instanceof HTMLElement)) throw new Error('missing card');

    target.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }));
    target.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 40, clientY: 40 }));
    target.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientX: 40, clientY: 40 }));

    expect(onRaise).not.toHaveBeenCalled();
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('指がキャンセルされても掴んだままにしない（勝手に選ばない）', () => {
    const onCommit = vi.fn();
    const onSelect = vi.fn();
    const { container } = renderSurface({ onCommit, onSelect });
    const target = container.querySelector('[data-card-id="c1"]');
    if (!(target instanceof HTMLElement)) throw new Error('missing card');
    act(() => {
      target.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }));
    });
    act(() => {
      target.dispatchEvent(pointerEvent('pointercancel', { pointerId: 1, clientX: 0, clientY: 0 }));
    });
    expect(Number(target.style.zIndex)).toBeLessThan(1000);
    // 離したわけではないので、選択は変えない。
    expect(onSelect).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('カードが指の操作を受ける（ブラウザのスクロールに取られない）', () => {
    const { container } = renderSurface();
    for (const element of container.querySelectorAll('[data-card-id]')) {
      if (!(element instanceof HTMLElement)) continue;
      expect(element.style.touchAction).toBe('none');
    }
  });

  it('隅に俯瞰（全体マップ）を出す（寄ったまま迷子にならないように）', () => {
    const { container } = renderSurface();
    expect(container.querySelector('[data-verify-unit="CanvasMinimap"]')).not.toBeNull();
  });

  it('カードが無いときは俯瞰を出さない（映すものが無い）', () => {
    const { container } = renderSurface({ cards: [] });
    expect(container.querySelector('[data-verify-unit="CanvasMinimap"]')).toBeNull();
  });

  it('枠が広いカードほど本文の文字が大きい', () => {
    // 盤面ごと縮めて映すので、固定サイズだと引いたときに本文だけ先に潰れる。
    const { container } = renderSurface({
      cards: [card('c1'), { ...card('c2', 300, 200), width: 524 }],
    });
    const paragraphs = [...container.querySelectorAll('[data-card-id] p')];
    const sizes = paragraphs.map((p) =>
      p instanceof HTMLElement ? Number.parseFloat(p.style.fontSize) : Number.NaN,
    );

    expect(sizes[0]).toBe(17);
    expect(sizes[1]).toBe(34);
  });
});

/** jsdom の PointerEvent は限定的なので、必要な座標だけ持つ MouseEvent で代用する。 */
function pointerEvent(
  type: string,
  init: { pointerId: number; clientX: number; clientY: number },
): Event {
  const event = new MouseEvent(type, {
    bubbles: true,
    clientX: init.clientX,
    clientY: init.clientY,
  });
  Object.defineProperty(event, 'pointerId', { value: init.pointerId });
  return event;
}
