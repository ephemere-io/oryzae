'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ApiClient } from '@/lib/api';

interface EntryContent {
  title: string;
  preview: string;
  createdAt: string;
}

interface SnippetContent {
  text: string;
}

interface PhotoContent {
  imageUrl: string;
  caption: string;
}

export interface BoardCardData {
  id: string;
  cardType: 'entry' | 'snippet' | 'photo';
  refId: string;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  zIndex: number;
  createdAt: string;
  content: EntryContent | SnippetContent | PhotoContent;
  removing?: boolean;
}

interface BoardData {
  dateKey: string;
  viewType: string;
  cards: BoardCardData[];
}

/**
 * Apply default z-ordering by creation time (newer on top).
 * Cards whose z-index was bumped by user interaction (drag) are preserved.
 *
 * Auto-assigned z-indexes are sequential (0..N-1).
 * User-dragged cards get z-index >= N (via zCounterRef in use-board-interaction).
 * We re-sort only the auto-assigned group by createdAt, keeping user-modified cards on top.
 */
function applyDefaultZOrder(cards: BoardCardData[]): BoardCardData[] {
  if (cards.length <= 1) return cards;

  const total = cards.length;
  const autoCards: BoardCardData[] = [];
  const userCards: BoardCardData[] = [];

  for (const card of cards) {
    if (card.zIndex >= total) {
      userCards.push(card);
    } else {
      autoCards.push(card);
    }
  }

  // Sort auto-assigned cards by createdAt ASC (newer = higher z-index = on top)
  autoCards.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Reassign z-indexes for auto cards: 0, 1, 2, ...
  const result = autoCards.map((card, i) => ({ ...card, zIndex: i }));

  // Append user-modified cards (keep their z-index)
  return [...result, ...userCards];
}

export function useBoard(
  api: ApiClient | null,
  dateKey: string,
  viewType: 'daily' | 'weekly' = 'daily',
) {
  const [cards, setCards] = useState<BoardCardData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBoard = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    const res = await api.fetch(`/api/v1/board?dateKey=${dateKey}&viewType=${viewType}`);
    if (res.ok) {
      const data: BoardData = await res.json();
      setCards(applyDefaultZOrder(data.cards));
    }
    setLoading(false);
  }, [api, dateKey, viewType]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  const createSnippet = useCallback(
    async (text: string) => {
      if (!api) return;
      const res = await api.fetch('/api/v1/board/snippets', {
        method: 'POST',
        body: JSON.stringify({ text, dateKey, viewType }),
      });
      if (res.ok) {
        await fetchBoard();
      }
    },
    [api, dateKey, viewType, fetchBoard],
  );

  const updateSnippet = useCallback(
    async (snippetId: string, text: string) => {
      if (!api) return;
      const res = await api.fetch(`/api/v1/board/snippets/${snippetId}`, {
        method: 'PUT',
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        setCards((prev) =>
          prev.map((c) =>
            c.refId === snippetId && c.cardType === 'snippet' ? { ...c, content: { text } } : c,
          ),
        );
      }
    },
    [api],
  );

  const deleteCard = useCallback(
    async (cardId: string, cardType: string, refId: string) => {
      if (!api) return;
      // 1. Mark card as removing (triggers animation)
      setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, removing: true } : c)));
      // 2. API call
      if (cardType === 'snippet') {
        api.fetch(`/api/v1/board/snippets/${refId}`, { method: 'DELETE' });
      } else if (cardType === 'photo') {
        api.fetch(`/api/v1/board/photos/${refId}`, { method: 'DELETE' });
      } else {
        api.fetch(`/api/v1/board/cards/${cardId}`, { method: 'DELETE' });
      }
      // 3. Remove from state after animation (280ms)
      setTimeout(() => {
        setCards((prev) => prev.filter((c) => c.id !== cardId));
      }, 280);
    },
    [api],
  );

  const createPhoto = useCallback(
    async (file: File, caption: string) => {
      if (!api) return;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('caption', caption);
      formData.append('dateKey', dateKey);
      formData.append('viewType', viewType);
      const res = await api.fetch('/api/v1/board/photos', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        await fetchBoard();
      }
    },
    [api, dateKey, viewType, fetchBoard],
  );

  return {
    cards,
    setCards,
    loading,
    refresh: fetchBoard,
    createSnippet,
    updateSnippet,
    createPhoto,
    deleteCard,
  };
}
