'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ApiClient } from '@/lib/api';

interface EntryDetail {
  id: string;
  content: string;
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

    api.api.v1.entries[':id'].$get({ param: { id } }).then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        if ('entry' in data && data.entry != null) {
          const e = data.entry;
          setEntry({
            id: e.id,
            content: e.content,
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

export function useSaveEntry(api: ApiClient | null, auth: AuthState | null) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = useCallback(
    async (content: string, entryId?: string): Promise<boolean> => {
      if (!api || !auth || !content.trim()) return false;
      setSaving(true);
      setError('');

      const emptyMediaUrls: string[] = [];
      const body = {
        content,
        mediaUrls: emptyMediaUrls,
        editorType: 'plaintext',
        editorVersion: '1.0.0',
        extension: {},
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.accessToken}`,
      };

      if (entryId) {
        const url = api.api.v1.entries[':id'].$url({
          param: { id: entryId },
        });
        const res = await fetch(url, {
          method: 'PUT',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          setError('保存に失敗しました');
          setSaving(false);
          return false;
        }
      } else {
        const url = api.api.v1.entries.$url();
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          setError('作成に失敗しました');
          setSaving(false);
          return false;
        }
      }

      setSaving(false);
      return true;
    },
    [api, auth],
  );

  return { save, saving, error };
}

export function useDeleteEntry(api: ApiClient | null) {
  const [deleting, setDeleting] = useState(false);

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      if (!api) return false;
      setDeleting(true);
      await api.api.v1.entries[':id'].$delete({ param: { id } });
      setDeleting(false);
      return true;
    },
    [api],
  );

  return { remove, deleting };
}
