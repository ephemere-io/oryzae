'use client';

import { useCallback, useState } from 'react';
import { z } from 'zod';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { parseJson } from '@/lib/json';

const triggerScheduledFermentationResultSchema = z.object({
  dateKey: z.string(),
  totalUsers: z.number(),
  totalFermentations: z.number(),
  succeeded: z.number(),
  failed: z.number(),
  errors: z.array(z.object({ userId: z.string(), questionId: z.string(), error: z.string() })),
});

type TriggerScheduledFermentationResult = z.infer<typeof triggerScheduledFermentationResultSchema>;

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

    const body = res.ok ? await parseJson(res, triggerScheduledFermentationResultSchema) : null;
    if (body) {
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
