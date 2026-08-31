'use client';

import { useCallback, useState } from 'react';
import type { ApiClient } from '@/lib/api';

interface UseSaveEntryContentResult {
  /** 保存する。中身が変わっていれば true。 */
  save: (entryId: string, content: string) => Promise<boolean>;
  saving: boolean;
  error: boolean;
}

/**
 * カード上で直した日記を保存する。
 *
 * 取得は持たない。盤面の応答が既に本文の全部を運んでいるので、編集のために
 * 取り直す必要がない（取り直していた頃は、編集に入るたびに「読み込み中」が挟まり、
 * 表示と編集で中身が食い違っていた）。
 *
 * PUT の本文は `features/shared/entries` の save と同じ形にそろえてある。
 * shared 同士でもドメインをまたぐ import は禁止なので、契約はここで持つ。
 * `effects` と `fermentationEnabled` は**送らない**——サーバは undefined を
 * 「既存を維持」と解釈するので、送らないほうが安全に保てる。
 */
export function useSaveEntryContent(api: ApiClient | null): UseSaveEntryContentResult {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const save = useCallback(
    async (entryId: string, content: string) => {
      if (!api) return false;
      // 空にして保存すると日記が消える。空文字はサーバも弾くが、ここで止める。
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
        return true;
      } catch {
        setError(true);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [api],
  );

  return { save, saving, error };
}
