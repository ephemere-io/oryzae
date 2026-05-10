import { act, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useJarDrag } from '@/features/fermentation/hooks/use-jar-drag';

interface PointerArgs {
  pointerId?: number;
  clientX?: number;
  clientY?: number;
  button?: number;
}

interface FakePointerTarget {
  setPointerCapture: ReturnType<typeof vi.fn>;
  releasePointerCapture: ReturnType<typeof vi.fn>;
  hasPointerCapture: ReturnType<typeof vi.fn>;
}

function fakeTarget(): FakePointerTarget {
  return {
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: vi.fn().mockReturnValue(true),
  };
}

// We construct minimal event-like objects that satisfy the hook's read sites.
// The hook only touches: pointerId, clientX, clientY, currentTarget.{set,release}PointerCapture,
// and on the click event: stopPropagation. Casts here are scoped to test plumbing.
function pointerEvent(target: FakePointerTarget, args: PointerArgs = {}) {
  return {
    pointerId: args.pointerId ?? 1,
    clientX: args.clientX ?? 0,
    clientY: args.clientY ?? 0,
    button: args.button ?? 0,
    currentTarget: target,
    // @type-assertion-allowed: テスト用の最小 PointerEvent ダミー
  } as unknown as React.PointerEvent<HTMLElement>;
}

function clickEvent() {
  return {
    stopPropagation: vi.fn(),
    // @type-assertion-allowed: テスト用の最小 MouseEvent ダミー
  } as unknown as React.MouseEvent<HTMLElement>;
}

interface SetupOpts {
  enabled?: boolean;
  startX?: number;
  startY?: number;
  containerWidth?: number;
  containerHeight?: number;
}

function setupHook(opts: SetupOpts = {}) {
  const onClickWithoutDrag = vi.fn();
  const onDragMove = vi.fn();
  const onDragEnd = vi.fn();
  const containerWidth = opts.containerWidth ?? 1000;
  const containerHeight = opts.containerHeight ?? 500;

  const { result } = renderHook(() => {
    const ref = useRef<HTMLElement | null>(null);
    if (!ref.current) {
      // Stub the bounding rect read by the hook on pointerDown.
      ref.current = {
        getBoundingClientRect: () =>
          ({
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            right: containerWidth,
            bottom: containerHeight,
            width: containerWidth,
            height: containerHeight,
            toJSON: () => ({}),
          }) as DOMRect,
        // @type-assertion-allowed: テスト用の最小 HTMLElement スタブ
      } as unknown as HTMLElement;
    }
    return useJarDrag({
      containerRef: ref,
      enabled: opts.enabled ?? true,
      x: opts.startX ?? 50,
      y: opts.startY ?? 50,
      onClickWithoutDrag,
      onDragMove,
      onDragEnd,
    });
  });

  return { result, onClickWithoutDrag, onDragMove, onDragEnd };
}

describe('useJarDrag', () => {
  it('閾値以下の動きはクリック扱いで onClickWithoutDrag を呼び、onDragEnd は呼ばれない', () => {
    const { result, onClickWithoutDrag, onDragEnd } = setupHook();
    const target = fakeTarget();

    act(() => {
      result.current.pointerHandlers.onPointerDown(
        pointerEvent(target, { clientX: 100, clientY: 100 }),
      );
    });
    act(() => {
      result.current.pointerHandlers.onPointerMove(
        pointerEvent(target, { clientX: 102, clientY: 101 }),
      );
    });
    act(() => {
      result.current.pointerHandlers.onPointerUp(
        pointerEvent(target, { clientX: 102, clientY: 101 }),
      );
    });
    act(() => {
      result.current.pointerHandlers.onClick(clickEvent());
    });

    expect(onClickWithoutDrag).toHaveBeenCalledTimes(1);
    expect(onDragEnd).not.toHaveBeenCalled();
  });

  it('閾値を超える移動でドラッグになり、onDragMove と onDragEnd が呼ばれる', () => {
    const { result, onClickWithoutDrag, onDragMove, onDragEnd } = setupHook({
      startX: 50,
      startY: 50,
      containerWidth: 1000,
      containerHeight: 500,
    });
    const target = fakeTarget();

    act(() => {
      result.current.pointerHandlers.onPointerDown(
        pointerEvent(target, { clientX: 0, clientY: 0 }),
      );
    });
    // 100px right, 50px down → +10% x (100/1000), +10% y (50/500) → (60, 60)
    act(() => {
      result.current.pointerHandlers.onPointerMove(
        pointerEvent(target, { clientX: 100, clientY: 50 }),
      );
    });
    act(() => {
      result.current.pointerHandlers.onPointerUp(
        pointerEvent(target, { clientX: 100, clientY: 50 }),
      );
    });
    // The synthetic click after drag must be suppressed by the hook.
    act(() => {
      result.current.pointerHandlers.onClick(clickEvent());
    });

    expect(onDragMove).toHaveBeenLastCalledWith(60, 60);
    expect(onDragEnd).toHaveBeenCalledWith(60, 60);
    expect(onClickWithoutDrag).not.toHaveBeenCalled();
  });

  it('座標は 0-100 にクランプされる', () => {
    const { result, onDragEnd } = setupHook({
      startX: 90,
      startY: 10,
      containerWidth: 100,
      containerHeight: 100,
    });
    const target = fakeTarget();

    act(() => {
      result.current.pointerHandlers.onPointerDown(
        pointerEvent(target, { clientX: 0, clientY: 0 }),
      );
    });
    // +50px (=+50% x) → 90+50=140 → clamp to 100
    // -50px (=-50% y) → 10-50=-40 → clamp to 0
    act(() => {
      result.current.pointerHandlers.onPointerMove(
        pointerEvent(target, { clientX: 50, clientY: -50 }),
      );
    });
    act(() => {
      result.current.pointerHandlers.onPointerUp(
        pointerEvent(target, { clientX: 50, clientY: -50 }),
      );
    });

    expect(onDragEnd).toHaveBeenCalledWith(100, 0);
  });

  it('enabled=false ではドラッグ開始せず、クリックは従来通り発火する', () => {
    const { result, onClickWithoutDrag, onDragEnd } = setupHook({ enabled: false });
    const target = fakeTarget();

    act(() => {
      result.current.pointerHandlers.onPointerDown(
        pointerEvent(target, { clientX: 0, clientY: 0 }),
      );
    });
    // この pointer move は無視される（session が無いので）
    act(() => {
      result.current.pointerHandlers.onPointerMove(
        pointerEvent(target, { clientX: 100, clientY: 100 }),
      );
    });
    act(() => {
      result.current.pointerHandlers.onPointerUp(
        pointerEvent(target, { clientX: 100, clientY: 100 }),
      );
    });
    act(() => {
      result.current.pointerHandlers.onClick(clickEvent());
    });

    expect(target.setPointerCapture).not.toHaveBeenCalled();
    expect(onClickWithoutDrag).toHaveBeenCalledTimes(1);
    expect(onDragEnd).not.toHaveBeenCalled();
  });

  it('右クリック・中クリックは無視される', () => {
    const { result } = setupHook();
    const target = fakeTarget();

    act(() => {
      result.current.pointerHandlers.onPointerDown(pointerEvent(target, { button: 2 }));
    });

    expect(target.setPointerCapture).not.toHaveBeenCalled();
  });

  it('onPointerCancel で session が破棄されてドラッグ後に onDragEnd は呼ばれない', () => {
    const { result, onDragEnd } = setupHook();
    const target = fakeTarget();

    act(() => {
      result.current.pointerHandlers.onPointerDown(
        pointerEvent(target, { clientX: 0, clientY: 0 }),
      );
    });
    act(() => {
      result.current.pointerHandlers.onPointerMove(
        pointerEvent(target, { clientX: 100, clientY: 0 }),
      );
    });
    act(() => {
      result.current.pointerHandlers.onPointerCancel(pointerEvent(target));
    });
    act(() => {
      result.current.pointerHandlers.onPointerUp(
        pointerEvent(target, { clientX: 100, clientY: 0 }),
      );
    });

    expect(onDragEnd).not.toHaveBeenCalled();
  });
});
