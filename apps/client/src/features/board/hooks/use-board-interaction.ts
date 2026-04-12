'use client';

import { useCallback, useRef, useState } from 'react';
import type { BoardCardData } from './use-board';

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

const MIN_SIZE = 120;
const DRAG_THRESHOLD = 4;

export function useBoardInteraction(
  cards: BoardCardData[],
  onCardsChange: (cards: BoardCardData[]) => void,
  onInteractionEnd: () => void,
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

  const startRotate = useCallback((cardId: string, centerX: number, centerY: number) => {
    stateRef.current = { type: 'rotate', cardId, centerX, centerY };
  }, []);

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
        if (!didDragRef.current && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
        didDragRef.current = true;
        setDraggingId(state.cardId);
        updateCard(state.cardId, {
          x: state.cardStartX + dx,
          y: state.cardStartY + dy,
        });
      } else if (state.type === 'rotate') {
        const angle =
          Math.atan2(pointerY - state.centerY, pointerX - state.centerX) * (180 / Math.PI);
        const rounded = Math.round(angle * 10) / 10;
        updateCard(state.cardId, { rotation: rounded });
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
    [updateCard],
  );

  const onPointerUp = useCallback(() => {
    const state = stateRef.current;
    if (state) {
      if (state.type === 'drag') {
        zCounterRef.current += 1;
        updateCard(state.cardId, { zIndex: zCounterRef.current });
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
