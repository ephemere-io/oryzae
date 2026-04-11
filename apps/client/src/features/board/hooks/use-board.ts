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

export interface BoardCardData {
  id: string;
  cardType: 'entry' | 'snippet';
  refId: string;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  zIndex: number;
  content: EntryContent | SnippetContent;
}

interface BoardData {
  dateKey: string;
  viewType: string;
  cards: BoardCardData[];
}

export function useBoard(api: ApiClient | null, dateKey: string) {
  const [cards, setCards] = useState<BoardCardData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBoard = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    const res = await api.fetch(`/api/v1/board?dateKey=${dateKey}`);
    if (res.ok) {
      const data: BoardData = await res.json();
      setCards(data.cards);
    }
    setLoading(false);
  }, [api, dateKey]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  const createSnippet = useCallback(
    async (text: string) => {
      if (!api) return;
      const res = await api.fetch('/api/v1/board/snippets', {
        method: 'POST',
        body: JSON.stringify({ text, dateKey }),
      });
      if (res.ok) {
        await fetchBoard();
      }
    },
    [api, dateKey, fetchBoard],
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
      if (cardType === 'snippet') {
        await api.fetch(`/api/v1/board/snippets/${refId}`, { method: 'DELETE' });
      } else {
        await api.fetch(`/api/v1/board/cards/${cardId}`, { method: 'DELETE' });
      }
      setCards((prev) => prev.filter((c) => c.id !== cardId));
    },
    [api],
  );

  return {
    cards,
    setCards,
    loading,
    refresh: fetchBoard,
    createSnippet,
    updateSnippet,
    deleteCard,
  };
}
