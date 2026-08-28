'use client';

import { type EditorEffectsState, editorEffectsStateSchema } from '@oryzae/shared';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import type { ApiClient } from '@/lib/api';
import { isObject, readJson, readStringField } from '@/lib/json';

interface EntryDetail {
  id: string;
  content: string;
  effects: EditorEffectsState | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * `GET /api/v1/entries/:id` の正規化。
 *
 * `await res.json()` は `any` を返すので、そのまま `e.id` 等を読むと型検査も
 * `pnpm check:as` もすり抜けたまま未検証の値が state に入る（`as` が無いので
 * 検出器にも見えない）。id / content が無ければ「取れなかった」として null。
 * effects は共有スキーマで検証し、壊れていれば null に倒す（エディタは効果なしで開ける）。
 */
function normalizeEntryDetail(input: unknown): EntryDetail | null {
  if (!isObject(input)) return null;
  const entry = input.entry;
  const id = readStringField(entry, 'id');
  const content = readStringField(entry, 'content');
  if (id === null || content === null) return null;

  const rawEffects = isObject(entry) ? entry.effects : null;
  const parsedEffects = editorEffectsStateSchema.safeParse(rawEffects);

  return {
    id,
    content,
    effects: parsedEffects.success ? parsedEffects.data : null,
    createdAt: readStringField(entry, 'createdAt') ?? '',
    updatedAt: readStringField(entry, 'updatedAt') ?? '',
  };
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
        const next = normalizeEntryDetail(await readJson(res));
        if (next) setEntry(next);
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
        mediaUrls: [],
        editorType: 'plaintext',
        editorVersion: '1.0.0',
        extension: {},
      };
      if (options?.fermentationEnabled !== undefined) {
        payload.fermentationEnabled = options.fermentationEnabled;
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

      // 作成は成功しているのに id が読めないと、呼び出し側は失敗と区別がつかない。
      // autosave (use-autosave-entry) は id を受け取れないと entryId を記録できず、
      // 次のティックで再 POST してエントリを重複作成する。エラーを立てて気づけるようにする。
      const id = readStringField(await readJson(res), 'id');
      if (id === null) {
        setError(t('error_create'));
      }
      setSaving(false);
      return id;
    },
    [api, t],
  );

  return { save, saving, error };
}
