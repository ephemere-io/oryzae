'use client';

import { useCallback, useRef, useState } from 'react';
import type { BoardCardData } from '@/features/shared/board/types';

type InteractionType = 'drag' | 'rotate' | 'resize';
type ResizeCorner = 'se' | 'sw' | 'ne' | 'nw';

interface DragState {
  type: 'drag';
  cardId: string;
  startX: number;
  startY: number;
  cardStartX: number;
  cardStartY: number;
}

interface RotateState {
  type: 'rotate';
  cardId: string;
  centerX: number;
  centerY: number;
  startAngle: number;
  cardStartRotation: number;
}

interface ResizeState {
  type: 'resize';
  cardId: string;
  corner: ResizeCorner;
  startX: number;
  startY: number;
  cardStartX: number;
  cardStartY: number;
  cardStartW: number;
  cardStartH: number;
}

type InteractionState = DragState | RotateState | ResizeState | null;

/** world 単位。`boardCardUpdateSchema` の width/height 下限（120）と揃える。 */
const MIN_SIZE = 120;
/** ドラッグとみなす移動量（**画面 px**）。world 換算は scale で割って求める。 */
const DRAG_THRESHOLD_PX = 4;

/**
 * ボード上のカードのドラッグ・回転・リサイズ。
 *
 * **座標はすべて world 単位で受け取る**（`clientX/Y` ではない）。呼び出し側が
 * `CanvasSurface.toWorld()` で変換してから渡すこと。こうしておくとズーム倍率が
 * この hook に一切漏れず、位置計算は「world の差分を world の値に足す」だけで済む。
 *
 * 唯一 scale を知る必要があるのは「どれだけ動いたらドラッグ開始か」の閾値で、これは
 * ユーザーの指の移動量＝画面 px で決まるべきものなので、world 換算に scale を使う。
 *
 * @param scale 現在の表示倍率。ドラッグ開始閾値の換算にのみ使う。
 */
export function useBoardInteraction(
  cards: BoardCardData[],
  onCardsChange: (cards: BoardCardData[]) => void,
  onInteractionEnd: () => void,
  scale = 1,
) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const stateRef = useRef<InteractionState>(null);
  const didDragRef = useRef(false);
  const zCounterRef = useRef(cards.length > 0 ? Math.max(...cards.map((c) => c.zIndex)) + 1 : 100);

  const updateCard = useCallback(
    (cardId: string, update: Partial<BoardCardData>) => {
      onCardsChange(cards.map((c) => (c.id === cardId ? { ...c, ...update } : c)));
    },
    [cards, onCardsChange],
  );

  const startDrag = useCallback(
    (cardId: string, pointerX: number, pointerY: number) => {
      const card = cards.find((c) => c.id === cardId);
      if (!card) return;

      setSelectedId(cardId);
      didDragRef.current = false;
      stateRef.current = {
        type: 'drag',
        cardId,
        startX: pointerX,
        startY: pointerY,
        cardStartX: card.x,
        cardStartY: card.y,
      };
    },
    [cards],
  );

  const startRotate = useCallback(
    (cardId: string, centerX: number, centerY: number, pointerX: number, pointerY: number) => {
      const card = cards.find((c) => c.id === cardId);
      if (!card) return;
      const startAngle = Math.atan2(pointerY - centerY, pointerX - centerX) * (180 / Math.PI);
      stateRef.current = {
        type: 'rotate',
        cardId,
        centerX,
        centerY,
        startAngle,
        cardStartRotation: card.rotation,
      };
    },
    [cards],
  );

  const startResize = useCallback(
    (cardId: string, corner: ResizeCorner, pointerX: number, pointerY: number) => {
      const card = cards.find((c) => c.id === cardId);
      if (!card) return;

      stateRef.current = {
        type: 'resize',
        cardId,
        corner,
        startX: pointerX,
        startY: pointerY,
        cardStartX: card.x,
        cardStartY: card.y,
        cardStartW: card.width,
        cardStartH: card.height,
      };
    },
    [cards],
  );

  const onPointerMove = useCallback(
    (pointerX: number, pointerY: number) => {
      const state = stateRef.current;
      if (!state) return;

      if (state.type === 'drag') {
        const dx = pointerX - state.startX;
        const dy = pointerY - state.startY;
        // 閾値は画面 px 基準。引いた状態（scale<1）で過敏に、寄った状態（scale>1）で
        // 鈍くならないよう world 単位に換算してから比べる。
        const thresholdWorld = DRAG_THRESHOLD_PX / scale;
        if (!didDragRef.current && Math.abs(dx) + Math.abs(dy) < thresholdWorld) return;
        didDragRef.current = true;
        setDraggingId(state.cardId);
        updateCard(state.cardId, {
          x: state.cardStartX + dx,
          y: state.cardStartY + dy,
        });
      } else if (state.type === 'rotate') {
        const currentAngle =
          Math.atan2(pointerY - state.centerY, pointerX - state.centerX) * (180 / Math.PI);
        const delta = currentAngle - state.startAngle;
        const rotation = Math.round((state.cardStartRotation + delta) * 10) / 10;
        updateCard(state.cardId, { rotation });
      } else if (state.type === 'resize') {
        const dx = pointerX - state.startX;
        const dy = pointerY - state.startY;
        let newW = state.cardStartW;
        let newH = state.cardStartH;
        let newX = state.cardStartX;
        let newY = state.cardStartY;

        if (state.corner === 'se') {
          newW = Math.max(MIN_SIZE, state.cardStartW + dx);
          newH = Math.max(MIN_SIZE, state.cardStartH + dy);
        } else if (state.corner === 'sw') {
          newW = Math.max(MIN_SIZE, state.cardStartW - dx);
          newH = Math.max(MIN_SIZE, state.cardStartH + dy);
          newX = state.cardStartX + (state.cardStartW - newW);
        } else if (state.corner === 'ne') {
          newW = Math.max(MIN_SIZE, state.cardStartW + dx);
          newH = Math.max(MIN_SIZE, state.cardStartH - dy);
          newY = state.cardStartY + (state.cardStartH - newH);
        } else if (state.corner === 'nw') {
          newW = Math.max(MIN_SIZE, state.cardStartW - dx);
          newH = Math.max(MIN_SIZE, state.cardStartH - dy);
          newX = state.cardStartX + (state.cardStartW - newW);
          newY = state.cardStartY + (state.cardStartH - newH);
        }

        updateCard(state.cardId, { x: newX, y: newY, width: newW, height: newH });
      }
    },
    [updateCard, scale],
  );

  const onPointerUp = useCallback(() => {
    const state = stateRef.current;
    if (state) {
      if (state.type === 'drag') {
        zCounterRef.current += 1;
        // ここが「利用者が自分で位置を決めた」瞬間。フラグを立てて保存に乗せることで、
        // 次回以降の自動整列（applyDefaultZOrder）の対象から外れる。
        updateCard(state.cardId, { zIndex: zCounterRef.current, userPositioned: true });
      }
      onInteractionEnd();
    }
    stateRef.current = null;
    setDraggingId(null);
  }, [updateCard, onInteractionEnd]);

  const deselect = useCallback(() => {
    setSelectedId(null);
  }, []);

  const getInteractionType = (): InteractionType | null => {
    return stateRef.current?.type ?? null;
  };

  const didDrag = () => didDragRef.current;

  return {
    selectedId,
    setSelectedId,
    draggingId,
    startDrag,
    startRotate,
    startResize,
    onPointerMove,
    onPointerUp,
    deselect,
    getInteractionType,
    didDrag,
  };
}
