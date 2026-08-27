'use client';

import type { EditorEffectsState } from '@oryzae/shared';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import type { ApiClient } from '@/lib/api';

interface EntryDetail {
  id: string;
  content: string;
  /** 保存されているストレージパス。保存時にそのまま送り返す。 */
  mediaUrls: string[];
  /** 表示用の署名付き URL（1時間で失効するので保存してはいけない）。 */
  mediaSignedUrls: string[];
  effects: EditorEffectsState | null;
  createdAt: string;
  updatedAt: string;
}

interface AuthState {
  accessToken: string;
}

export function useEntry(id: string, api: ApiClient | null, authLoading: boolean) {
  const [entry, setEntry] = useState<EntryDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !api) return;

    api.fetch(`/api/v1/entries/${id}`).then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        if ('entry' in data && data.entry != null) {
          const e = data.entry;
          setEntry({
            id: e.id,
            content: e.content,
            mediaUrls: Array.isArray(e.mediaUrls) ? e.mediaUrls.map(String) : [],
            // mediaSignedUrls はレスポンスの top-level（entry の中ではない）。
            mediaSignedUrls: Array.isArray(data.mediaSignedUrls)
              ? data.mediaSignedUrls.map(String)
              : [],
            effects: e.effects ?? null,
            createdAt: e.createdAt,
            updatedAt: e.updatedAt,
          });
        }
      }
      setLoading(false);
    });
  }, [api, authLoading, id]);

  return { entry, loading };
}

interface SaveOptions {
  fermentationEnabled?: boolean;
  // undefined → 既存を維持 / null → クリア / state → 差し替え
  effects?: EditorEffectsState | null;
  // undefined → 既存を維持 / 配列 → 差し替え。自動保存は本文しか知らないので
  // 省略され、サーバー側で既存の media_urls が維持される（写真が消えない）。
  mediaUrls?: string[];
}

export function useSaveEntry(api: ApiClient | null, _auth: AuthState | null) {
  const t = useTranslations('entries.save_hook');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = useCallback(
    async (content: string, entryId?: string, options?: SaveOptions): Promise<string | null> => {
      if (!api || !content.trim()) return null;
      setSaving(true);
      setError('');

      const payload: Record<string, unknown> = {
        content,
        editorType: 'plaintext',
        editorVersion: '1.0.0',
        extension: {},
      };
      if (options?.fermentationEnabled !== undefined) {
        payload.fermentationEnabled = options.fermentationEnabled;
      }
      // 送らなければサーバーは既存の media_urls を維持する。自動保存が写真を巻き添えに
      // しないよう、明示的に変えたいときだけ載せる。
      if (options?.mediaUrls !== undefined) {
        payload.mediaUrls = options.mediaUrls;
      }
      if (options?.effects !== undefined) {
        payload.effects = options.effects;
      }
      const body = JSON.stringify(payload);

      if (entryId) {
        const res = await api.fetch(`/api/v1/entries/${entryId}`, { method: 'PUT', body });
        if (!res.ok) {
          setError(t('error_save'));
          setSaving(false);
          return null;
        }
        setSaving(false);
        return entryId;
      }

      const res = await api.fetch('/api/v1/entries', { method: 'POST', body });
      if (!res.ok) {
        setError(t('error_create'));
        setSaving(false);
        return null;
      }

      const data = (await res.json()) as { id: string };
      setSaving(false);
      return data.id;
    },
    [api, t],
  );

  return { save, saving, error };
}
