'use client';

import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { parseJson } from '@/lib/json';
import { type Newsletter, newsletterSchema } from '../types';

const listResponseSchema = z.object({ data: z.array(newsletterSchema) });

/** ニュースレター一覧（下書き + 送信済み、新しい順）。 */
export function useNewsletters() {
  const [data, setData] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    const api = createApiClient(token);
    const res = await api.fetch('/api/v1/admin/newsletters');
    const body = res.ok ? await parseJson(res, listResponseSchema) : null;
    if (body) {
      setData(body.data);
    } else {
      setError('ニュースレターの取得に失敗しました');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}
