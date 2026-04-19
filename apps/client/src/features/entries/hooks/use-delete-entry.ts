'use client';

import { useCallback, useState } from 'react';
import type { ApiClient } from '@/lib/api';

export function useDeleteEntry(api: ApiClient | null) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const deleteEntry = useCallback(
    async (entryId: string): Promise<boolean> => {
      if (!api) return false;
      setDeleting(true);
      setError('');

      const res = await api.fetch(`/api/v1/entries/${entryId}`, { method: 'DELETE' });
      if (!res.ok) {
        setError('削除に失敗しました');
        setDeleting(false);
        return false;
      }

      setDeleting(false);
      return true;
    },
    [api],
  );

  return { deleteEntry, deleting, error };
}
