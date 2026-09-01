'use client';

import { useCallback, useState } from 'react';
import type { BoardCardData } from '@/features/shared/board/types';

interface Draft {
  title: string;
  body: string;
}

interface UseEntryCardDraftResult {
  /** カード上で編集中の entry カード id。null なら誰も編集していない。 */
  editingCardId: string | null;
  draft: Draft;
  setTitle: (next: string) => void;
  setBody: (next: string) => void;
  /** 編集を始める。entry 以外・本文を持たないカードは無視する。 */
  start: (card: BoardCardData) => void;
  /** 編集を終える（保存は呼び出し側の仕事）。 */
  stop: () => void;
}

/**
 * カード上の編集の「入り口」を1本にする。
 *
 * 以前は編集フラグを直に立てる書き方が別経路に残っており、**下書きを積まないまま
 * 編集モードに入る**ことがあった。見えている本文はそのままなのに編集欄は空、という
 * 食い違いが起きる。ここを通らないと編集に入れない形にして、構造として塞ぐ。
 *
 * 取得はしない。カードが既に本文の全部を持っているので、その場で写すだけでよい。
 */
export function useEntryCardDraft(): UseEntryCardDraftResult {
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ title: '', body: '' });

  const start = useCallback((card: BoardCardData) => {
    if (card.cardType !== 'entry' || !('body' in card.content)) return;
    setDraft({ title: card.content.title, body: card.content.body });
    setEditingCardId(card.id);
  }, []);

  const stop = useCallback(() => setEditingCardId(null), []);
  const setTitle = useCallback((title: string) => setDraft((d) => ({ ...d, title })), []);
  const setBody = useCallback((body: string) => setDraft((d) => ({ ...d, body })), []);

  return { editingCardId, draft, setTitle, setBody, start, stop };
}
