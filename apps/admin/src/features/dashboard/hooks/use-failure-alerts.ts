'use client';

import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { parseJson } from '@/lib/json';

const failureItemSchema = z.object({
  id: z.string(),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
});

const failureGroupSchema = z.object({
  userId: z.string(),
  email: z.string(),
  failures: z.array(failureItemSchema),
});

const failuresResponseSchema = z.object({ groups: z.array(failureGroupSchema) });

export type FailureGroup = z.infer<typeof failureGroupSchema>;

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
    const data = res.ok ? await parseJson(res, failuresResponseSchema) : null;
    if (data) {
      setGroups(data.groups);
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
