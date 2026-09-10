import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BoardCardData } from '@/features/shared/board/types';
import { SpBoardSurface, toWorldDelta } from '@/features/sp/board/components/sp-board-surface';
import { IDENTITY_VIEWPORT } from '@/lib/canvas/viewport';
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

describe('toWorldDelta', () => {
  it('等倍なら指の移動量がそのまま world の移動量', () => {
    expect(toWorldDelta(100, 1)).toBe(100);
  });

  it('縮小して表示しているぶんだけ world では大きく動く', () => {
    // 0.5 倍で表示 → 画面 50px の移動は world では 100px。
    // ここを割らないとカードが指から離れていく。
    expect(toWorldDelta(50, 0.5)).toBe(100);
  });

  it('拡大表示では world の移動が小さくなる', () => {
    expect(toWorldDelta(100, 2)).toBe(50);
  });

  it('負の方向も同じ', () => {
    expect(toWorldDelta(-40, 0.5)).toBe(-80);
  });

  it('scale が 0 や不正でも 0 を返す（カードが飛ばない）', () => {
    expect(toWorldDelta(100, 0)).toBe(0);
    expect(toWorldDelta(100, -1)).toBe(0);
    expect(toWorldDelta(100, Number.NaN)).toBe(0);
    expect(toWorldDelta(Number.NaN, 1)).toBe(0);
  });
});

describe('SpBoardSurface', () => {
  function renderSurface(overrides: Partial<React.ComponentProps<typeof SpBoardSurface>> = {}) {
    const props = {
      cards: [card('c1'), card('c2', 300, 200)],
      viewport: IDENTITY_VIEWPORT,
      onMove: vi.fn(),
      onCommit: vi.fn(),
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
    const { container } = renderSurface({ onMove, viewport: { x: 0, y: 0, scale: 0.5 } });
    const target = container.querySelector('[data-card-id="c1"]');
    if (!(target instanceof HTMLElement)) throw new Error('missing card');
    target.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }));
    target.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 50, clientY: 0 }));

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
