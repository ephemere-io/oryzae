'use client';

import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { parseJson } from '@/lib/json';

const userActivitySchema = z.object({
  activeWriters: z.number(),
  totalUsers: z.number(),
  returningUsers: z.number().optional(),
  previousActiveUsers: z.number().optional(),
});

export function useUserActivity(dateFrom?: string, dateTo?: string) {
  const [activeWriters, setActiveWriters] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [returningUsers, setReturningUsers] = useState(0);
  const [previousActiveUsers, setPreviousActiveUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivity = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    // Issue #367: セレクタで選んだ日は「見ている人のローカル暦日」。これを送らないと
    // サーバーは UTC の 00:00〜24:00 として切るので、JST では 9 時間ずれた数が出る。
    params.set('tzOffset', String(new Date().getTimezoneOffset()));
    const qs = params.toString();

    const api = createApiClient(token);
    const res = await api.fetch(`/api/v1/admin/dashboard/user-activity${qs ? `?${qs}` : ''}`);
    const parsed = res.ok ? await parseJson(res, userActivitySchema) : null;
    if (parsed) {
      setActiveWriters(parsed.activeWriters);
      setTotalUsers(parsed.totalUsers);
      setReturningUsers(parsed.returningUsers ?? 0);
      setPreviousActiveUsers(parsed.previousActiveUsers ?? 0);
    } else if (!res.ok) {
      setError('ユーザーアクティビティの取得に失敗しました');
    }
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  return {
    activeWriters,
    totalUsers,
    returningUsers,
    previousActiveUsers,
    loading,
    error,
    refresh: fetchActivity,
  };
}
