'use client';

import type { CSSProperties, ReactNode, RefObject } from 'react';
import { useJarDrag } from '@/features/fermentation/hooks/use-jar-drag';

interface DraggableJarElementProps {
  /**
   * Element whose bounding rect defines 100%. For the QuestionCircle in the jar this is the
   * JarView root; for inner elements (keyword/snippet/letter) it's the QuestionCircle wrapper.
   */
  containerRef: RefObject<HTMLElement | null>;
  /** Disable drag interaction. Click still fires through `onClickWithoutDrag`. */
  enabled: boolean;
  /** Current position as 0-100 percentages of the container. */
  x: number;
  y: number;
  onClickWithoutDrag: () => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: (x: number, y: number) => void;
  className?: string;
  /**
   * Inline styles for the wrapper. `position`, `top`, `left`, and pointer/touch behaviour are
   * managed by this component — anything here is merged on top.
   */
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * Wrapper that turns its child into a draggable Jar-view element. Position is in percent so the
 * same DOM works on any viewport size; the actual top/left styles are written by this component
 * from `x` / `y`. While dragging we suppress CSS transitions so the element follows the cursor.
 */
export function DraggableJarElement({
  containerRef,
  enabled,
  x,
  y,
  onClickWithoutDrag,
  onDragMove,
  onDragEnd,
  className,
  style,
  children,
}: DraggableJarElementProps) {
  const { isDragging, pointerHandlers } = useJarDrag({
    containerRef,
    enabled,
    x,
    y,
    onClickWithoutDrag,
    onDragMove,
    onDragEnd,
  });

  return (
    <div
      {...pointerHandlers}
      className={className}
      style={{
        ...style,
        position: 'absolute',
        top: `${y}%`,
        left: `${x}%`,
        cursor: enabled ? (isDragging ? 'grabbing' : 'grab') : style?.cursor,
        // Suppress CSS transitions during drag so movement isn't smoothed away from the cursor.
        transition: isDragging ? 'none' : style?.transition,
        // touch-action:none lets us intercept touch drags without the browser scrolling.
        touchAction: enabled ? 'none' : style?.touchAction,
        userSelect: enabled ? 'none' : style?.userSelect,
      }}
    >
      {children}
    </div>
  );
}
