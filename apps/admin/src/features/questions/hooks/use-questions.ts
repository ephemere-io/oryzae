'use client';

import { useCallback, useEffect, useState } from 'react';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

// admin/dashboard 用 Questions 一覧 (issue #287)
//
// readiness は問い単位のスコア (charScore/timeScore とも問いスコープ)。
// サーバ側 evaluateQuestionEligibility と同じ shape。

export interface QuestionItem {
  id: string;
  user_id: string;
  user_email: string;
  user_nickname: string;
  text: string;
  is_archived: boolean;
  is_validated_by_user: boolean;
  is_proposed_by_oryzae: boolean;
  created_at: string;
  updated_at: string;
  readiness: {
    score: number; // [0, 1]
    charScore: number;
    timeScore: number;
    threshold: number;
    charsCurrent: number;
    hoursElapsed: number | null;
    hoursRequired: number | null;
    eligible: boolean;
    language: 'ja' | 'en';
  };
}

interface QuestionsResponse {
  data: QuestionItem[];
  pagination: { page: number; limit: number; total: number };
}

interface UseQuestionsParams {
  page?: number;
  limit?: number;
  q?: string;
  userId?: string;
  archived?: 'true' | 'false';
}

export function useQuestions(params?: UseQuestionsParams) {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 50;
  const q = params?.q;
  const userId = params?.userId;
  const archived = params?.archived;
  const [data, setData] = useState<QuestionItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    const api = createApiClient(token);
    const searchParams = new URLSearchParams();
    searchParams.set('page', String(page));
    searchParams.set('limit', String(limit));
    if (q) searchParams.set('q', q);
    if (userId) searchParams.set('user_id', userId);
    if (archived) searchParams.set('archived', archived);

    const res = await api.fetch(`/api/v1/admin/questions?${searchParams.toString()}`);
    if (res.ok) {
      const body = (await res.json()) as QuestionsResponse;
      setData(body.data);
      setPagination(body.pagination);
    } else {
      setError('問いデータの取得に失敗しました');
    }
    setLoading(false);
  }, [page, limit, q, userId, archived]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, pagination, loading, error, refresh: fetchData };
}
