'use client';

import {
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  useCallback,
  useRef,
  useState,
} from 'react';

/** Pixels of movement before a press becomes a drag. Below this, we treat it as a tap/click. */
const DRAG_THRESHOLD_PX = 5;

interface UseJarDragOptions {
  /**
   * Element whose bounding rect defines 100%. For circle position this is the JarView container,
   * for inner elements (keyword/snippet/letter) it's the QuestionCircle itself.
   */
  containerRef: RefObject<HTMLElement | null>;
  /** Disable drag entirely (e.g. when the circle isn't zoomed). Click still fires. */
  enabled: boolean;
  /** Current element position as 0-100 percentages. Used as the start of the next drag. */
  x: number;
  y: number;
  /** Fired on tap (pointer down → up without enough movement to count as a drag). */
  onClickWithoutDrag: () => void;
  /** Fired during a drag with the new clamped percentage. */
  onDragMove: (x: number, y: number) => void;
  /** Fired once when the drag ends, with the final clamped percentage. */
  onDragEnd: (x: number, y: number) => void;
}

interface DragSession {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  /** Element % at drag start. */
  startX: number;
  startY: number;
  containerWidth: number;
  containerHeight: number;
  /** Latest computed % so onDragEnd can persist it. */
  lastX: number;
  lastY: number;
}

function clampPct(v: number): number {
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

interface UseJarDragResult {
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
 * Drag-and-drop hook for the Jar view. Each draggable element instantiates the hook and spreads
 * `pointerHandlers` onto its wrapper div. Coordinates are normalised to 0-100% of the container,
 * so the same drag works regardless of viewport size.
 *
 * Click vs drag is decided by movement past {@link DRAG_THRESHOLD_PX}; below the threshold the
 * release is treated as a click and `onClickWithoutDrag` fires (matching the prior tap-to-zoom UX).
 */
export function useJarDrag(options: UseJarDragOptions): UseJarDragResult {
  const { containerRef, enabled, x, y, onClickWithoutDrag, onDragMove, onDragEnd } = options;
  const sessionRef = useRef<DragSession | null>(null);
  const didDragRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (!enabled) return;
      // Only react to the primary button — right-click and middle-click stay no-ops.
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
        // Safari/Edge sometimes throw if capture was already lost; swallow.
      }
      sessionRef.current = null;
      setIsDragging(false);
      if (didDragRef.current) {
        onDragEnd(s.lastX, s.lastY);
      }
      // If didDragRef is false, the browser will fire `click` next; onClick handles it.
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
      // Prevent the JarView backdrop's "click anywhere to deselect" from firing too.
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
