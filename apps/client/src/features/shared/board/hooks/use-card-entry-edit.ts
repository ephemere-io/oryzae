'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiClient } from '@/lib/api';

interface UseCardEntryEditResult {
  /** 編集中の本文。読み込み前は空。 */
  content: string;
  setContent: (next: string) => void;
  loading: boolean;
  /** 取得か保存に失敗した。 */
  error: boolean;
  saving: boolean;
  /** 変更があれば保存する。保存したら true。 */
  save: () => Promise<boolean>;
}

/**
 * カードの上で日記を編集するための、本文の出し入れ。
 *
 * 盤面のカードが持っているのは**先頭 200 文字の抜粋**だけなので、それを編集して
 * 保存すると日記が切り詰められる。編集に入った時点で `GET /entries/:id` から
 * 全文を取り直し、保存もその全文に対して行う。
 *
 * `features/shared/entries` の useSaveEntry は使えない（shared 同士でもドメインを
 * またぐ import は禁止）。PUT の本文はあちらと同じ形にそろえてある——`effects` と
 * `fermentationEnabled` は**送らない**こと。サーバは undefined を「既存を維持」と
 * 解釈するので、送らないほうが安全に保てる。
 */
export function useCardEntryEdit(
  api: ApiClient | null,
  entryId: string | null,
): UseCardEntryEditResult {
  const [content, setContent] = useState('');
  /**
   * 全文を取り終えた entryId。`loading` を state で持つと、entryId が入った直後の
   * 1フレームだけ「読み込み中でないのに本文が空」になり、そこへ打った文字が
   * 到着した全文で消える。取れたかどうかから導く。
   */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  /** 取得した直後の本文。変わっていなければ保存しない。 */
  const loadedRef = useRef('');
  /** 取得の世代。編集対象を切り替えたときに古い応答で上書きしないため。 */
  const generationRef = useRef(0);

  useEffect(() => {
    if (!api || !entryId) {
      setContent('');
      loadedRef.current = '';
      return;
    }
    const generation = ++generationRef.current;
    setLoadedFor(null);
    setError(false);
    void (async () => {
      try {
        const res = await api.fetch(`/api/v1/entries/${entryId}`);
        if (!res.ok) throw new Error(`Failed to load entry (${res.status})`);
        const data: unknown = await res.json();
        const entry =
          typeof data === 'object' && data !== null && 'entry' in data ? data.entry : null;
        const text =
          typeof entry === 'object' && entry !== null && 'content' in entry ? entry.content : null;
        if (generation !== generationRef.current) return;
        if (typeof text !== 'string') throw new Error('Entry content missing');
        setContent(text);
        loadedRef.current = text;
        setLoadedFor(entryId);
      } catch {
        if (generation !== generationRef.current) return;
        // 抜粋のまま編集させると、保存した瞬間に日記が 200 文字へ切り詰められる。
        // 取れなかったときは編集させない。
        setError(true);
        setContent('');
        loadedRef.current = '';
      }
    })();
  }, [api, entryId]);

  const save = useCallback(async () => {
    if (!api || !entryId) return false;
    if (content === loadedRef.current) return false;
    if (content.trim().length === 0) return false;

    setSaving(true);
    setError(false);
    try {
      const res = await api.fetch(`/api/v1/entries/${entryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          mediaUrls: [],
          editorType: 'plaintext',
          editorVersion: '1.0.0',
          extension: {},
        }),
      });
      if (!res.ok) throw new Error(`Failed to save entry (${res.status})`);
      loadedRef.current = content;
      return true;
    } catch {
      setError(true);
      return false;
    } finally {
      setSaving(false);
    }
  }, [api, entryId, content]);

  // 対象が決まっていて、まだその全文が届いていないあいだが「読み込み中」。
  const loading = entryId !== null && loadedFor !== entryId && !error;

  return { content, setContent, loading, error, saving, save };
}
