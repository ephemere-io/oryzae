'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useCreateSnippet } from '@/features/shared/board/hooks/use-create-snippet';
import { normalizeBoardCards } from '@/features/shared/board/normalize';
import type { BoardCardData, CardPlacement } from '@/features/shared/board/types';
import type { ApiClient } from '@/lib/api';

/**
 * 自動配置のカードだけを作成日時順（新しいものほど手前）に並べ直す。
 * 利用者が自分で動かしたカードは、その重なり順をそのまま保つ。
 *
 * 判定には `userPositioned`（サーバー保存のフラグ）を使う。
 * 以前は「z_index >= 総枚数」で推測していたが、カードを削除すると総枚数が縮むため、
 * 触っていないカードが判定を満たして手前に固定されてしまっていた
 * （z_index の値からは「採番当時の総枚数」を復元できないので、式では直せない）。
 */
function applyDefaultZOrder(cards: BoardCardData[]): BoardCardData[] {
  if (cards.length <= 1) return cards;

  const autoCards: BoardCardData[] = [];
  const userCards: BoardCardData[] = [];

  for (const card of cards) {
    if (card.userPositioned) {
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

/** 削除エンドポイントはカード種別で分かれる。 */
function deletePath(cardId: string, cardType: string, refId: string): string {
  if (cardType === 'snippet') return `/api/v1/board/snippets/${refId}`;
  if (cardType === 'photo') return `/api/v1/board/photos/${refId}`;
  return `/api/v1/board/cards/${cardId}`;
}

export function useBoard(
  api: ApiClient | null,
  dateKey: string,
  viewType: 'daily' | 'weekly' = 'daily',
) {
  const [cards, setCards] = useState<BoardCardData[]>([]);
  const [loading, setLoading] = useState(true);
  // 取得失敗を surface する（use-entries と同じ形）。これが無いと失敗が「空の盤面」に
  // なり、利用者には「この日は何も無い」と区別がつかない。
  const [error, setError] = useState(false);
  const postSnippet = useCreateSnippet(api);
  const requestIdRef = useRef(0);

  const fetchBoard = useCallback(async () => {
    if (!api) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(false);
    // ローカル暦日で「その日」を判定させるためオフセットを送る。これが無いとサーバーは
    // dateKey を UTC の 00:00〜24:00 とみなし、JST 00:00〜09:00 に書いたエントリが
    // 当日のボードに出ない（Issue: ボードの日付境界）。
    const tzOffset = new Date().getTimezoneOffset();
    try {
      const res = await api.fetch(
        `/api/v1/board?dateKey=${dateKey}&viewType=${viewType}&tzOffset=${tzOffset}`,
      );
      if (requestId !== requestIdRef.current) return;
      if (res.ok) {
        const data: unknown = await res.json();
        if (requestId !== requestIdRef.current) return;
        setCards(applyDefaultZOrder(normalizeBoardCards(data)));
      } else {
        setError(true);
      }
    } catch {
      if (requestId === requestIdRef.current) setError(true);
      // 通信・パースの失敗。呼び出し元は useEffect 内の async 関数で、投げても誰も
      // 受け取らない（未処理 rejection になり loading が戻らず盤面が固まる）ので、
      // ここで止める。盤面は現状維持のまま error を立て、表示は BoardView に委ねる。
    } finally {
      // 後発リクエストに追い越されていたら loading の所有権は向こうにあるので触らない。
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [api, dateKey, viewType]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  const createSnippet = useCallback(
    async (text: string, placement?: CardPlacement) => {
      if (await postSnippet({ text, dateKey, viewType, ...placement })) {
        await fetchBoard();
      }
    },
    [postSnippet, dateKey, viewType, fetchBoard],
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
      // 1. 消えるアニメーションを始める（ここは即時＝操作に対する反応を待たせない）
      setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, removing: true } : c)));

      // 2. 削除完了とアニメーション(280ms)の両方を待つ。
      //    以前は結果を見ずに投げっぱなしで 280ms 後に必ず state から消していたため、
      //    サーバー側で失敗してもカードは画面から消え、リロードすると復活していた。
      //    reject も誰も受け取らず未処理 rejection になっていた。
      const [ok] = await Promise.all([
        api.fetch(deletePath(cardId, cardType, refId), { method: 'DELETE' }).then(
          (res) => res.ok,
          () => false,
        ),
        new Promise((resolve) => setTimeout(resolve, 280)),
      ]);

      // 3. 成功したときだけ取り除く。失敗したらアニメーションを戻して盤面に残す
      //    （ボードに専用のエラー表示は無いので、「消えない」ことを結果として見せる）。
      setCards((prev) =>
        ok
          ? prev.filter((c) => c.id !== cardId)
          : prev.map((c) => (c.id === cardId ? { ...c, removing: false } : c)),
      );
    },
    [api],
  );

  const createPhoto = useCallback(
    async (
      file: File,
      caption: string,
      imageWidth?: number,
      imageHeight?: number,
      placement?: CardPlacement,
    ) => {
      if (!api) return;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('caption', caption);
      formData.append('dateKey', dateKey);
      formData.append('viewType', viewType);
      if (imageWidth && imageHeight) {
        formData.append('imageWidth', String(imageWidth));
        formData.append('imageHeight', String(imageHeight));
      }
      if (placement) {
        formData.append('x', String(placement.x));
        formData.append('y', String(placement.y));
      }
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
    error,
    refresh: fetchBoard,
    createSnippet,
    updateSnippet,
    createPhoto,
    deleteCard,
  };
}
