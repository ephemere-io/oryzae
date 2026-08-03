'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

interface UserStats {
  streak: number;
  totalEntries: number;
  totalChars: number;
  totalFermentations: number;
  weeklyChars: number;
  monthlyChars: number;
  entriesByQuestion: { questionId: string; questionText: string; count: number }[];
  monthlyTrend: { month: string; entries: number; chars: number }[];
}

export function useUserStats() {
  const t = useTranslations('stats.error');
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    const api = createApiClient(token);
    const res = await api.fetch('/api/v1/users/me/stats');
    if (res.ok) {
      setStats((await res.json()) as UserStats);
    } else {
      setError(t('fetch_failed'));
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refresh: fetchStats };
}
