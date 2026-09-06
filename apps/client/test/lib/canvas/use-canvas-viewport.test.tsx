import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CanvasViewport } from '@/components/ui/canvas-viewport';
import { useCanvasViewport } from '@/lib/canvas/use-canvas-viewport';
import { MAX_SCALE, MIN_SCALE, screenToWorld, type Viewport } from '@/lib/canvas/viewport';

// hook 単体では frame/world の ref が埋まらず、ホイール・パンのリスナが張られない。
// 実際の配線（CanvasViewport が ref を渡す）ごと検証したいので、最小のハーネスで描画する。

const STORAGE_KEY = 'oryzae:viewport:test-canvas';
const FRAME_LEFT = 50;
const FRAME_TOP = 20;
const FRAME_WIDTH = 800;
const FRAME_HEIGHT = 600;

function Harness({ storageKey = 'test-canvas' }: { storageKey?: string }) {
  const canvas = useCanvasViewport({ storageKey });
  return (
    <CanvasViewport canvas={canvas} ariaLabel="test canvas">
      <div data-testid="child" />
      <button type="button" data-testid="zoom-in" onClick={canvas.zoomIn}>
        in
      </button>
      <button type="button" data-testid="zoom-out" onClick={canvas.zoomOut}>
        out
      </button>
      <button type="button" data-testid="reset" onClick={canvas.resetZoom}>
        reset
      </button>
      <button
        type="button"
        data-testid="fit"
        onClick={() => canvas.fitTo({ x: 0, y: 0, width: 1600, height: 1200 })}
      >
        fit
      </button>
    </CanvasViewport>
  );
}

function frameEl(): HTMLElement {
  return screen.getByRole('application', { name: 'test canvas' });
}

/** world ノード（frame の最初の子）。transform をここから読む。 */
function worldEl(): HTMLElement {
  const world = frameEl().firstElementChild;
  if (!(world instanceof HTMLElement)) throw new Error('world node not found');
  return world;
}

/** DOM に書かれた transform を Viewport に読み戻す。 */
function readViewport(): Viewport {
  const transform = worldEl().style.transform;
  const match = transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)\s*scale\((-?[\d.e]+)\)/);
  if (!match) throw new Error(`unexpected transform: "${transform}"`);
  return { x: Number(match[1]), y: Number(match[2]), scale: Number(match[3]) };
}

/** jsdom は常に 0 サイズの矩形を返すので、frame にだけ実サイズを持たせる。 */
function stubFrameRect() {
  const el = frameEl();
  el.getBoundingClientRect = () => new DOMRect(FRAME_LEFT, FRAME_TOP, FRAME_WIDTH, FRAME_HEIGHT);
}

/** rAF 1回ぶん進めて DOM への反映を待つ。 */
async function flushFrame() {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
}

async function dispatchWheel(init: WheelEventInit): Promise<boolean> {
  const event = new WheelEvent('wheel', { cancelable: true, bubbles: true, ...init });
  act(() => {
    frameEl().dispatchEvent(event);
  });
  await flushFrame();
  return event.defaultPrevented;
}

describe('useCanvasViewport', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('初期状態は等倍・無移動', async () => {
    render(<Harness />);
    await flushFrame();
    expect(readViewport()).toEqual({ x: 0, y: 0, scale: 1 });
  });

  it('現在の倍率を --vp-scale として frame に publish する（逆スケール用）', async () => {
    render(<Harness />);
    stubFrameRect();
    await flushFrame();
    expect(frameEl().style.getPropertyValue('--vp-scale')).toBe('1');

    act(() => {
      screen.getByTestId('zoom-in').click();
    });
    await flushFrame();
    expect(Number(frameEl().style.getPropertyValue('--vp-scale'))).toBeGreaterThan(1);
  });

  describe('ホイール', () => {
    it('ctrl+ホイールはカーソル直下の world 点を固定したままズームする', async () => {
      render(<Harness />);
      stubFrameRect();
      await flushFrame();

      // frame 座標に直したアンカー位置。
      const clientX = FRAME_LEFT + 300;
      const clientY = FRAME_TOP + 200;
      const anchorX = 300;
      const anchorY = 200;

      const before = screenToWorld(readViewport(), anchorX, anchorY);
      await dispatchWheel({ deltaY: -240, ctrlKey: true, clientX, clientY });
      const after = readViewport();

      expect(after.scale).toBeGreaterThan(1);
      const anchorAfter = screenToWorld(after, anchorX, anchorY);
      expect(anchorAfter.x).toBeCloseTo(before.x, 6);
      expect(anchorAfter.y).toBeCloseTo(before.y, 6);
    });

    it('ctrl+ホイールを逆に回すと縮小する', async () => {
      render(<Harness />);
      stubFrameRect();
      await flushFrame();

      await dispatchWheel({ deltaY: 240, ctrlKey: true, clientX: 400, clientY: 300 });
      expect(readViewport().scale).toBeLessThan(1);
    });

    it('素のホイールは倍率を変えずにパンする（スクロール方向と一致）', async () => {
      render(<Harness />);
      stubFrameRect();
      await flushFrame();

      await dispatchWheel({ deltaX: 30, deltaY: 50 });
      expect(readViewport()).toEqual({ x: -30, y: -50, scale: 1 });
    });

    it('ホイールを preventDefault する（ブラウザのページズームに奪われない）', async () => {
      render(<Harness />);
      stubFrameRect();
      await flushFrame();

      expect(await dispatchWheel({ deltaY: 50 })).toBe(true);
      expect(await dispatchWheel({ deltaY: 50, ctrlKey: true, clientX: 100, clientY: 100 })).toBe(
        true,
      );
    });

    it('行単位のホイール（deltaMode=1）は px に換算される', async () => {
      render(<Harness />);
      stubFrameRect();
      await flushFrame();

      await dispatchWheel({ deltaY: 3, deltaMode: 1 });
      // 3 行 × 16px = 48px 分パンする。
      expect(readViewport().y).toBe(-48);
    });

    it('回し続けても倍率は上限・下限を超えない', async () => {
      render(<Harness />);
      stubFrameRect();
      await flushFrame();

      for (let i = 0; i < 40; i++) {
        await dispatchWheel({ deltaY: -500, ctrlKey: true, clientX: 400, clientY: 300 });
      }
      expect(readViewport().scale).toBe(MAX_SCALE);

      for (let i = 0; i < 80; i++) {
        await dispatchWheel({ deltaY: 500, ctrlKey: true, clientX: 400, clientY: 300 });
      }
      expect(readViewport().scale).toBe(MIN_SCALE);
    });
  });

  describe('ボタン操作', () => {
    it('ズームイン → ズームアウトで元の倍率に戻る', async () => {
      render(<Harness />);
      stubFrameRect();
      await flushFrame();

      act(() => {
        screen.getByTestId('zoom-in').click();
      });
      await flushFrame();
      const zoomedIn = readViewport().scale;
      expect(zoomedIn).toBeGreaterThan(1);

      act(() => {
        screen.getByTestId('zoom-out').click();
      });
      await flushFrame();
      expect(readViewport().scale).toBeCloseTo(1, 6);
    });

    it('リセットは倍率を等倍に戻す', async () => {
      render(<Harness />);
      stubFrameRect();
      await flushFrame();

      act(() => {
        screen.getByTestId('zoom-in').click();
        screen.getByTestId('zoom-in').click();
      });
      await flushFrame();
      expect(readViewport().scale).not.toBe(1);

      act(() => {
        screen.getByTestId('reset').click();
      });
      await flushFrame();
      expect(readViewport().scale).toBe(1);
    });

    it('全体表示は指定矩形が収まる倍率にする', async () => {
      render(<Harness />);
      stubFrameRect();
      await flushFrame();

      act(() => {
        screen.getByTestId('fit').click();
      });
      await flushFrame();

      // 1600x1200 を 800x600（padding 64）に収めるので必ず縮小方向。
      expect(readViewport().scale).toBeLessThan(1);
    });
  });

  describe('永続化', () => {
    it('操作後のビューポートを localStorage に保存する', async () => {
      render(<Harness />);
      stubFrameRect();
      await flushFrame();

      await dispatchWheel({ deltaX: 10, deltaY: 20 });

      await waitFor(() => {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        expect(raw).not.toBeNull();
        expect(JSON.parse(raw ?? '{}')).toMatchObject({ x: -10, y: -20, scale: 1 });
      });
    });

    it('保存済みのビューポートを復元して描画する', async () => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ x: -120, y: 45, scale: 1.5 }));
      render(<Harness />);
      await flushFrame();

      expect(readViewport()).toEqual({ x: -120, y: 45, scale: 1.5 });
    });

    it('壊れた保存値は無視して等倍で開く（白画面にしない）', async () => {
      window.localStorage.setItem(STORAGE_KEY, '{ not json');
      render(<Harness />);
      await flushFrame();
      expect(readViewport()).toEqual({ x: 0, y: 0, scale: 1 });
    });

    it('範囲外の倍率が保存されていてもクランプして復元する', async () => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ x: 0, y: 0, scale: 9999 }));
      render(<Harness />);
      await flushFrame();
      expect(readViewport().scale).toBe(MAX_SCALE);
    });

    it('型の違う保存値は無視する', async () => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ x: 'left', y: null, scale: '2' }));
      render(<Harness />);
      await flushFrame();
      expect(readViewport()).toEqual({ x: 0, y: 0, scale: 1 });
    });
  });

  describe('frame が後から現れる画面（読み込み中は null を返す）', () => {
    // JarView は `if (authLoading) return null` で、frame はマウントより後に現れる。
    // ここが ref のままだと「frame が付いた」ことに気づけず、ホイールが効かない・
    // 初期フィットもかからない状態で固まる（実機で踏んだ）。
    function LateHarness({ ready }: { ready: boolean }) {
      const canvas = useCanvasViewport({
        storageKey: 'late-canvas',
        defaultFitBounds: { x: 0, y: 0, width: 1600, height: 1000 },
      });
      if (!ready) return null;
      return (
        <CanvasViewport canvas={canvas} ariaLabel="test canvas">
          <div data-testid="child" />
        </CanvasViewport>
      );
    }

    it('遅れて現れた frame にもホイールが効き、初期フィットがかかる', async () => {
      const { rerender } = render(<LateHarness ready={false} />);
      expect(screen.queryByRole('application')).toBeNull();

      rerender(<LateHarness ready={true} />);
      // frame が付いた「後」に採寸できるようにする。初期フィットは採寸できるまで
      // rAF で測り直すので、ここから数フレーム進めれば適用される。
      stubFrameRect();
      await flushFrame();
      await flushFrame();

      // 1600x1000 を 800x600（padding 64）に収める倍率になっている＝初期フィットが効いた。
      const fitted = readViewport();
      expect(fitted.scale).toBeLessThan(1);
      expect(fitted.scale).toBeGreaterThan(0);

      // ホイールのリスナも張り直されている。
      const before = readViewport();
      await dispatchWheel({ deltaX: 25, deltaY: 15 });
      const after = readViewport();
      expect(after.x).toBe(before.x - 25);
      expect(after.y).toBe(before.y - 15);
    });
  });

  describe('キーボードショートカット', () => {
    function press(key: string, init: KeyboardEventInit = {}) {
      act(() => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
        );
      });
    }

    it('⌘0 で等倍に戻る', async () => {
      render(<Harness />);
      stubFrameRect();
      await flushFrame();

      act(() => {
        screen.getByTestId('zoom-in').click();
      });
      await flushFrame();
      expect(readViewport().scale).not.toBe(1);

      press('0', { metaKey: true });
      await flushFrame();
      expect(readViewport().scale).toBe(1);
    });

    it('⌘+ / ⌘- で拡大・縮小する', async () => {
      render(<Harness />);
      stubFrameRect();
      await flushFrame();

      press('+', { metaKey: true });
      await flushFrame();
      expect(readViewport().scale).toBeGreaterThan(1);

      press('-', { metaKey: true });
      await flushFrame();
      expect(readViewport().scale).toBeCloseTo(1, 6);
    });

    it('⌘0 は preventDefault してブラウザのページズームを奪う', () => {
      render(<Harness />);
      stubFrameRect();
      const event = new KeyboardEvent('keydown', {
        key: '0',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        window.dispatchEvent(event);
      });
      expect(event.defaultPrevented).toBe(true);
    });

    it('Shift+1 は getContentBounds の矩形に合わせる', async () => {
      function FitHarness() {
        const canvas = useCanvasViewport({
          getContentBounds: () => ({ x: 0, y: 0, width: 2400, height: 1800 }),
        });
        return (
          <CanvasViewport canvas={canvas} ariaLabel="test canvas">
            <div data-testid="child" />
          </CanvasViewport>
        );
      }
      render(<FitHarness />);
      stubFrameRect();
      await flushFrame();

      press('1', { shiftKey: true, code: 'Digit1' });
      await flushFrame();
      // 2400x1800 を 800x600 に収めるので必ず縮小方向。
      expect(readViewport().scale).toBeLessThan(1);
    });

    it('選択が無いとき Shift+2 は何もしない', async () => {
      function NoSelectionHarness() {
        const canvas = useCanvasViewport({ getSelectionBounds: () => null });
        return (
          <CanvasViewport canvas={canvas} ariaLabel="test canvas">
            <div data-testid="child" />
          </CanvasViewport>
        );
      }
      render(<NoSelectionHarness />);
      stubFrameRect();
      await flushFrame();
      const before = readViewport();

      press('2', { shiftKey: true, code: 'Digit2' });
      await flushFrame();
      expect(readViewport()).toEqual(before);
    });

    it('入力欄で打っているときは何も奪わない', async () => {
      render(<Harness />);
      stubFrameRect();
      await flushFrame();
      const before = readViewport();

      const input = document.createElement('input');
      document.body.appendChild(input);
      const event = new KeyboardEvent('keydown', {
        key: '0',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        input.dispatchEvent(event);
      });
      await flushFrame();

      expect(event.defaultPrevented).toBe(false);
      expect(readViewport()).toEqual(before);
      input.remove();
    });
  });

  describe('素の左ドラッグでパンする', () => {
    // 実機で「クリック&ドラッグで動かせない」と報告された退行の再発防止。
    // 以前は「押した先が frame か world そのもののとき」だけパンしていたため、
    // world 直下にラッパー（瓶の world ボックス等）があると背景を掴んでも動かなかった。
    function drag(from: EventTarget, dx: number, dy: number) {
      const opts = {
        bubbles: true,
        cancelable: true,
        pointerId: 5,
        pointerType: 'mouse',
        button: 0,
        buttons: 1,
        isPrimary: true,
      };
      act(() => {
        from.dispatchEvent(
          new PointerEvent('pointerdown', { ...opts, clientX: 400, clientY: 300 }),
        );
        window.dispatchEvent(
          new PointerEvent('pointermove', { ...opts, clientX: 400 + dx, clientY: 300 + dy }),
        );
        window.dispatchEvent(
          new PointerEvent('pointerup', {
            ...opts,
            buttons: 0,
            clientX: 400 + dx,
            clientY: 300 + dy,
          }),
        );
      });
    }

    it('frame の背景を掴んで動かせる', async () => {
      render(<Harness />);
      stubFrameRect();
      await flushFrame();
      const before = readViewport();

      drag(frameEl(), 70, -40);
      await flushFrame();

      const after = readViewport();
      expect(after.x).toBe(before.x + 70);
      expect(after.y).toBe(before.y - 40);
    });

    it('world 直下のラッパーを掴んでも動かせる（瓶の world ボックス相当）', async () => {
      function WrappedHarness() {
        const canvas = useCanvasViewport({});
        return (
          <CanvasViewport canvas={canvas} ariaLabel="test canvas">
            <div data-testid="world-box" style={{ width: 1600, height: 1000 }} />
          </CanvasViewport>
        );
      }
      render(<WrappedHarness />);
      stubFrameRect();
      await flushFrame();
      const before = readViewport();

      drag(screen.getByTestId('world-box'), 50, 30);
      await flushFrame();

      const after = readViewport();
      expect(after.x).toBe(before.x + 50);
      expect(after.y).toBe(before.y + 30);
    });

    it('data-canvas-no-pan を付けた要素の上ではパンを始めない（カード・操作UI）', async () => {
      function CardHarness() {
        const canvas = useCanvasViewport({});
        return (
          <CanvasViewport canvas={canvas} ariaLabel="test canvas">
            <div data-testid="card" data-canvas-no-pan="" style={{ width: 200, height: 100 }} />
          </CanvasViewport>
        );
      }
      render(<CardHarness />);
      stubFrameRect();
      await flushFrame();
      const before = readViewport();

      drag(screen.getByTestId('card'), 90, 90);
      await flushFrame();

      expect(readViewport()).toEqual(before);
    });

    it('no-pan 要素の**子孫**から始めてもパンしない', async () => {
      function NestedHarness() {
        const canvas = useCanvasViewport({});
        return (
          <CanvasViewport canvas={canvas} ariaLabel="test canvas">
            <div data-canvas-no-pan="">
              <span data-testid="inner">中身</span>
            </div>
          </CanvasViewport>
        );
      }
      render(<NestedHarness />);
      stubFrameRect();
      await flushFrame();
      const before = readViewport();

      drag(screen.getByTestId('inner'), 60, 60);
      await flushFrame();

      expect(readViewport()).toEqual(before);
    });
  });

  describe('2本指ピンチ', () => {
    function pointer(type: string, id: number, x: number, y: number, target: EventTarget) {
      act(() => {
        target.dispatchEvent(
          new PointerEvent(type, {
            pointerId: id,
            clientX: x,
            clientY: y,
            bubbles: true,
            cancelable: true,
            isPrimary: id === 1,
            button: 0,
          }),
        );
      });
    }

    it('指の間隔を広げると拡大する', async () => {
      render(<Harness />);
      stubFrameRect();
      await flushFrame();
      const before = readViewport();

      const frame = frameEl();
      pointer('pointerdown', 1, 300, 300, frame);
      pointer('pointerdown', 2, 400, 300, frame);
      // 中点を保ったまま間隔を 100 → 200 に広げる。
      pointer('pointermove', 1, 250, 300, window);
      pointer('pointermove', 2, 450, 300, window);
      await flushFrame();

      const after = readViewport();
      expect(after.scale).toBeGreaterThan(before.scale);

      pointer('pointerup', 1, 250, 300, window);
      pointer('pointerup', 2, 450, 300, window);
    });

    it('指の間隔を狭めると縮小する', async () => {
      render(<Harness />);
      stubFrameRect();
      await flushFrame();
      const before = readViewport();

      const frame = frameEl();
      pointer('pointerdown', 1, 250, 300, frame);
      pointer('pointerdown', 2, 450, 300, frame);
      pointer('pointermove', 1, 325, 300, window);
      pointer('pointermove', 2, 375, 300, window);
      await flushFrame();

      expect(readViewport().scale).toBeLessThan(before.scale);

      pointer('pointerup', 1, 325, 300, window);
      pointer('pointerup', 2, 375, 300, window);
    });

    it('2本指の中点を動かすと平行移動する（倍率は変えない）', async () => {
      render(<Harness />);
      stubFrameRect();
      await flushFrame();
      const before = readViewport();

      const frame = frameEl();
      pointer('pointerdown', 1, 300, 300, frame);
      pointer('pointerdown', 2, 400, 300, frame);
      // 間隔は 100 のまま、両方を +60 動かす。
      pointer('pointermove', 1, 360, 300, window);
      pointer('pointermove', 2, 460, 300, window);
      await flushFrame();

      const after = readViewport();
      expect(after.scale).toBeCloseTo(before.scale, 6);
      expect(after.x).toBeCloseTo(before.x + 60, 4);

      pointer('pointerup', 1, 360, 300, window);
      pointer('pointerup', 2, 460, 300, window);
    });
  });

  describe('subscribe', () => {
    it('反映のたびに購読者へ現在のビューポートを渡す', async () => {
      const seen: number[] = [];
      function SubHarness() {
        const canvas = useCanvasViewport({});
        useEffect(() => canvas.subscribe((vp) => seen.push(vp.scale)), [canvas]);
        return (
          <CanvasViewport canvas={canvas} ariaLabel="test canvas">
            <button type="button" data-testid="zoom-in" onClick={canvas.zoomIn}>
              in
            </button>
          </CanvasViewport>
        );
      }
      render(<SubHarness />);
      stubFrameRect();
      await flushFrame();
      const countAfterMount = seen.length;
      expect(countAfterMount).toBeGreaterThan(0);

      act(() => {
        screen.getByTestId('zoom-in').click();
      });
      await flushFrame();

      expect(seen.length).toBeGreaterThan(countAfterMount);
      expect(seen[seen.length - 1]).toBeGreaterThan(1);
    });

    it('解除後は呼ばれない', async () => {
      const seen: number[] = [];
      let unsubscribe = () => {};
      function SubHarness() {
        const canvas = useCanvasViewport({});
        // canvas は viewport 確定のたびに identity が変わる。cleanup を返さないと
        // 購読が積み上がり、解除しても古い購読が残って呼ばれ続ける。
        useEffect(() => {
          const off = canvas.subscribe((vp) => seen.push(vp.scale));
          unsubscribe = off;
          return off;
        }, [canvas]);
        return (
          <CanvasViewport canvas={canvas} ariaLabel="test canvas">
            <button type="button" data-testid="zoom-in" onClick={canvas.zoomIn}>
              in
            </button>
          </CanvasViewport>
        );
      }
      render(<SubHarness />);
      stubFrameRect();
      await flushFrame();

      act(() => {
        unsubscribe();
      });
      const before = seen.length;

      act(() => {
        screen.getByTestId('zoom-in').click();
      });
      await flushFrame();

      expect(seen.length).toBe(before);
    });
  });

  describe('toWorld', () => {
    it('frame の画面上のオフセットを差し引いてから world に変換する', async () => {
      let captured: { x: number; y: number } | null = null;
      function Probe() {
        const canvas = useCanvasViewport({});
        return (
          <CanvasViewport canvas={canvas} ariaLabel="test canvas">
            <button
              type="button"
              data-testid="probe"
              onClick={() => {
                captured = canvas.toWorld(FRAME_LEFT + 250, FRAME_TOP + 175);
              }}
            >
              probe
            </button>
          </CanvasViewport>
        );
      }
      render(<Probe />);
      stubFrameRect();
      await flushFrame();

      act(() => {
        screen.getByTestId('probe').click();
      });

      // 等倍・無移動なら frame 内の相対位置がそのまま world 座標。
      expect(captured).toEqual({ x: 250, y: 175 });
    });
  });
});
