'use client';

import { useCallback, useEffect, useState } from 'react';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

export interface FailureItem {
  id: string;
  errorMessage: string | null;
  createdAt: string;
}

export interface FailureGroup {
  userId: string;
  email: string;
  failures: FailureItem[];
}

export function useFailureAlerts() {
  const [groups, setGroups] = useState<FailureGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFailures = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    const api = createApiClient(token);
    const res = await api.fetch('/api/v1/admin/dashboard/failures-24h');
    if (res.ok) {
      const data: unknown = await res.json();
      if (typeof data === 'object' && data !== null && 'groups' in data) {
        const groupsRaw = (data as { groups: unknown }).groups; // @type-assertion-allowed: in 演算子で存在確認後
        if (Array.isArray(groupsRaw)) {
          setGroups(groupsRaw as FailureGroup[]); // @type-assertion-allowed: API レスポンスの shape
        }
      }
    } else {
      setError('障害情報の取得に失敗しました');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFailures();
  }, [fetchFailures]);

  const retryFermentation = useCallback(
    async (id: string): Promise<boolean> => {
      const token = getAccessToken();
      if (!token) return false;

      const api = createApiClient(token);
      const res = await api.fetch(`/api/v1/admin/fermentations/${id}/retry`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchFailures();
        return true;
      }
      return false;
    },
    [fetchFailures],
  );

  return { groups, loading, error, refresh: fetchFailures, retryFermentation };
}
