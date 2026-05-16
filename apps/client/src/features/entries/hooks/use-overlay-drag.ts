'use client';

import {
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  useCallback,
  useRef,
  useState,
} from 'react';

const DRAG_THRESHOLD_PX = 5;

interface UseOverlayDragOptions {
  containerRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  x: number;
  y: number;
  onClickWithoutDrag: () => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: (x: number, y: number) => void;
}

interface DragSession {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  containerWidth: number;
  containerHeight: number;
  lastX: number;
  lastY: number;
}

function clampPct(v: number): number {
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

interface UseOverlayDragResult {
  isDragging: boolean;
  pointerHandlers: {
    onPointerDown: (e: PointerEvent<HTMLElement>) => void;
    onPointerMove: (e: PointerEvent<HTMLElement>) => void;
    onPointerUp: (e: PointerEvent<HTMLElement>) => void;
    onPointerCancel: (e: PointerEvent<HTMLElement>) => void;
    onClick: (e: MouseEvent<HTMLElement>) => void;
  };
}

/**
 * Issue #329: 発酵オーバーレイ用のドラッグ&クリックハンドラ。座標はコンテナの 0-100% で
 * 正規化し、ビューポートサイズが変わっても位置が壊れないようにする。クリックは
 * `DRAG_THRESHOLD_PX` 未満の動きで確定する。
 */
export function useOverlayDrag(options: UseOverlayDragOptions): UseOverlayDragResult {
  const { containerRef, enabled, x, y, onClickWithoutDrag, onDragMove, onDragEnd } = options;
  const sessionRef = useRef<DragSession | null>(null);
  const didDragRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (!enabled) return;
      if (e.button !== undefined && e.button !== 0) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      didDragRef.current = false;
      sessionRef.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startX: x,
        startY: y,
        containerWidth: rect.width,
        containerHeight: rect.height,
        lastX: x,
        lastY: y,
      };
    },
    [enabled, x, y, containerRef],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const s = sessionRef.current;
      if (!s || s.pointerId !== e.pointerId) return;
      const dx = e.clientX - s.startClientX;
      const dy = e.clientY - s.startClientY;
      if (!didDragRef.current && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      if (!didDragRef.current) {
        didDragRef.current = true;
        setIsDragging(true);
      }
      const newX = clampPct(s.startX + (dx / s.containerWidth) * 100);
      const newY = clampPct(s.startY + (dy / s.containerHeight) * 100);
      s.lastX = newX;
      s.lastY = newY;
      onDragMove(newX, newY);
    },
    [onDragMove],
  );

  const onPointerUp = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const s = sessionRef.current;
      if (!s || s.pointerId !== e.pointerId) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Safari/Edge may throw if capture already lost
      }
      sessionRef.current = null;
      setIsDragging(false);
      if (didDragRef.current) {
        onDragEnd(s.lastX, s.lastY);
      }
    },
    [onDragEnd],
  );

  const onPointerCancel = useCallback((e: PointerEvent<HTMLElement>) => {
    const s = sessionRef.current;
    if (!s || s.pointerId !== e.pointerId) return;
    sessionRef.current = null;
    setIsDragging(false);
    didDragRef.current = false;
  }, []);

  const onClick = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      e.stopPropagation();
      if (didDragRef.current) {
        didDragRef.current = false;
        return;
      }
      onClickWithoutDrag();
    },
    [onClickWithoutDrag],
  );

  return {
    isDragging,
    pointerHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClick },
  };
}
