'use client';

import { useCallback, useRef } from 'react';
import type { ApiClient } from '@/lib/api';
import type { BoardCardData } from './use-board';

export function useBoardSave(api: ApiClient | null) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const savePositions = useCallback(
    (cards: BoardCardData[]) => {
      if (!api) return;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(async () => {
        await api.fetch('/api/v1/board/cards', {
          method: 'PUT',
          body: JSON.stringify({
            cards: cards.map((c) => ({
              id: c.id,
              x: c.x,
              y: c.y,
              rotation: c.rotation,
              width: c.width,
              height: c.height,
              zIndex: c.zIndex,
            })),
          }),
        });
      }, 500);
    },
    [api],
  );

  return { savePositions };
}
