import { act, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useOverlayDrag } from '@/features/entries/hooks/use-overlay-drag';

interface PointerArgs {
  pointerId?: number;
  clientX?: number;
  clientY?: number;
  button?: number;
}

interface FakePointerTarget {
  setPointerCapture: ReturnType<typeof vi.fn>;
  releasePointerCapture: ReturnType<typeof vi.fn>;
}

function fakeTarget(): FakePointerTarget {
  return {
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
  };
}

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
}

function setupHook(opts: SetupOpts = {}) {
  const onClickWithoutDrag = vi.fn();
  const onDragMove = vi.fn();
  const onDragEnd = vi.fn();
  const containerWidth = 1000;
  const containerHeight = 500;

  const { result } = renderHook(() => {
    const ref = useRef<HTMLElement | null>(null);
    if (!ref.current) {
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
    return useOverlayDrag({
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

describe('useOverlayDrag', () => {
  it('閾値以下の動きはクリック扱いで onClickWithoutDrag を呼び、onDragEnd は呼ばれない', () => {
    const { result, onClickWithoutDrag, onDragMove, onDragEnd } = setupHook();
    const target = fakeTarget();
    act(() => {
      result.current.pointerHandlers.onPointerDown(pointerEvent(target));
      result.current.pointerHandlers.onPointerMove(
        pointerEvent(target, { clientX: 2, clientY: 1 }),
      );
      result.current.pointerHandlers.onPointerUp(pointerEvent(target));
      result.current.pointerHandlers.onClick(clickEvent());
    });
    expect(onDragMove).not.toHaveBeenCalled();
    expect(onDragEnd).not.toHaveBeenCalled();
    expect(onClickWithoutDrag).toHaveBeenCalledTimes(1);
  });

  it('閾値超過の動きはドラッグ扱いで onDragMove/onDragEnd を呼び、onClickWithoutDrag は呼ばれない', () => {
    const { result, onClickWithoutDrag, onDragMove, onDragEnd } = setupHook();
    const target = fakeTarget();
    act(() => {
      result.current.pointerHandlers.onPointerDown(pointerEvent(target));
      result.current.pointerHandlers.onPointerMove(
        pointerEvent(target, { clientX: 100, clientY: 50 }),
      );
      result.current.pointerHandlers.onPointerUp(pointerEvent(target));
      result.current.pointerHandlers.onClick(clickEvent());
    });
    // 100/1000 = 10% added to startX 50 → 60. 50/500 = 10% added to startY 50 → 60.
    expect(onDragMove).toHaveBeenCalledWith(60, 60);
    expect(onDragEnd).toHaveBeenCalledWith(60, 60);
    expect(onClickWithoutDrag).not.toHaveBeenCalled();
  });

  it('enabled=false のときは pointerDown を無視し、ドラッグ・クリックともに発火しない', () => {
    const { result, onClickWithoutDrag, onDragMove, onDragEnd } = setupHook({ enabled: false });
    const target = fakeTarget();
    act(() => {
      result.current.pointerHandlers.onPointerDown(pointerEvent(target));
      result.current.pointerHandlers.onPointerMove(
        pointerEvent(target, { clientX: 100, clientY: 100 }),
      );
      result.current.pointerHandlers.onPointerUp(pointerEvent(target));
    });
    expect(onDragMove).not.toHaveBeenCalled();
    expect(onDragEnd).not.toHaveBeenCalled();
    expect(onClickWithoutDrag).not.toHaveBeenCalled();
    expect(target.setPointerCapture).not.toHaveBeenCalled();
  });

  it('クランプ: コンテナ外への動きは 0-100% にクランプされる', () => {
    const { result, onDragMove } = setupHook({ startX: 50, startY: 50 });
    const target = fakeTarget();
    act(() => {
      result.current.pointerHandlers.onPointerDown(pointerEvent(target));
      // 1500px drag → 150% raw → clamp to 100
      result.current.pointerHandlers.onPointerMove(
        pointerEvent(target, { clientX: 1500, clientY: 1500 }),
      );
    });
    expect(onDragMove).toHaveBeenLastCalledWith(100, 100);
  });
});
