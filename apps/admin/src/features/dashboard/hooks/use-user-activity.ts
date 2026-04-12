'use client';

import { useCallback, useEffect, useState } from 'react';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

export function useUserActivity(dateFrom?: string, dateTo?: string) {
  const [activeWriters, setActiveWriters] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivity = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    const qs = params.toString();

    const api = createApiClient(token);
    const res = await api.fetch(`/api/v1/admin/dashboard/user-activity${qs ? `?${qs}` : ''}`);
    if (res.ok) {
      const data: unknown = await res.json();
      if (
        data !== null &&
        typeof data === 'object' &&
        'activeWriters' in data &&
        'totalUsers' in data
      ) {
        const parsed = data as { activeWriters: number; totalUsers: number }; // @type-assertion-allowed: 型ガード後のキャスト
        setActiveWriters(parsed.activeWriters);
        setTotalUsers(parsed.totalUsers);
      }
    } else {
      setError('ユーザーアクティビティの取得に失敗しました');
    }
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  return { activeWriters, totalUsers, loading, error, refresh: fetchActivity };
}
