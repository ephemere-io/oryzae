'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { isObject, readJson, readNumberField, readStringField } from '@/lib/json';

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

/**
 * 統計 API の正規化。集計値は欠けていても 0 として画面を出せるが、
 * 一覧は「配列でないものを state に入れない」（描画側 .map が落ちるため）。
 */
function normalizeUserStats(input: unknown): UserStats | null {
  if (!isObject(input)) return null;
  const byQuestion = Array.isArray(input.entriesByQuestion) ? input.entriesByQuestion : [];
  const trend = Array.isArray(input.monthlyTrend) ? input.monthlyTrend : [];
  return {
    streak: readNumberField(input, 'streak', 0),
    totalEntries: readNumberField(input, 'totalEntries', 0),
    totalChars: readNumberField(input, 'totalChars', 0),
    totalFermentations: readNumberField(input, 'totalFermentations', 0),
    weeklyChars: readNumberField(input, 'weeklyChars', 0),
    monthlyChars: readNumberField(input, 'monthlyChars', 0),
    entriesByQuestion: byQuestion.flatMap((row) => {
      const questionId = readStringField(row, 'questionId');
      if (questionId === null) return [];
      return [
        {
          questionId,
          questionText: readStringField(row, 'questionText') ?? '',
          count: readNumberField(row, 'count', 0),
        },
      ];
    }),
    monthlyTrend: trend.flatMap((row) => {
      const month = readStringField(row, 'month');
      if (month === null) return [];
      return [
        {
          month,
          entries: readNumberField(row, 'entries', 0),
          chars: readNumberField(row, 'chars', 0),
        },
      ];
    }),
  };
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
    const next = res.ok ? normalizeUserStats(await readJson(res)) : null;
    if (next) {
      setStats(next);
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
