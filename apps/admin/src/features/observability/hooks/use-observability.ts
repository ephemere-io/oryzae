'use client';

import { useCallback, useEffect, useState } from 'react';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

export interface ToolStatus {
  id: string;
  name: string;
  concern: string;
  configured: boolean;
  adminPath: string | null;
  externalUrl: string;
  description: string;
}

interface ObservabilityResponse {
  tools: ToolStatus[];
}

export function useObservability() {
  const [tools, setTools] = useState<ToolStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    const api = createApiClient(token);
    const res = await api.fetch('/api/v1/admin/observability/status');
    if (res.ok) {
      const body = (await res.json()) as ObservabilityResponse;
      setTools(body.tools);
    } else {
      setError('ツール状態の取得に失敗しました');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { tools, loading, error, refresh: fetchData };
}
