'use client';

import { useCallback, useState } from 'react';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

export interface TriggerScheduledFermentationResult {
  dateKey: string;
  totalUsers: number;
  totalFermentations: number;
  succeeded: number;
  failed: number;
  errors: Array<{ userId: string; questionId: string; error: string }>;
}

export function useTriggerScheduledFermentation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TriggerScheduledFermentationResult | null>(null);

  const trigger = useCallback(async (dateKey?: string): Promise<boolean> => {
    const token = getAccessToken();
    if (!token) return false;

    setLoading(true);
    setError(null);
    setResult(null);

    const api = createApiClient(token);
    const res = await api.fetch('/api/v1/admin/fermentations/trigger-scheduled', {
      method: 'POST',
      body: JSON.stringify(dateKey ? { dateKey } : {}),
    });

    if (res.ok) {
      const body = (await res.json()) as TriggerScheduledFermentationResult;
      setResult(body);
      setLoading(false);
      return true;
    }

    setError('発酵プロセスの発火に失敗しました');
    setLoading(false);
    return false;
  }, []);

  return { trigger, loading, error, result };
}
