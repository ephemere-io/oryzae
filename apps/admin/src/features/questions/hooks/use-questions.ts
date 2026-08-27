'use client';

import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { parseJson } from '@/lib/json';

// admin/dashboard 用 Questions 一覧 (issue #287)
//
// readiness は問い単位のスコア (charScore/timeScore とも問いスコープ)。
// サーバ側 evaluateQuestionEligibility と同じ shape。

const questionItemSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  user_email: z.string(),
  user_nickname: z.string(),
  text: z.string(),
  is_archived: z.boolean(),
  is_validated_by_user: z.boolean(),
  is_proposed_by_oryzae: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  readiness: z.object({
    score: z.number(), // [0, 1]
    charScore: z.number(),
    timeScore: z.number(),
    threshold: z.number(),
    charsCurrent: z.number(),
    hoursElapsed: z.number().nullable(),
    hoursRequired: z.number().nullable(),
    eligible: z.boolean(),
    language: z.enum(['ja', 'en']),
  }),
});

const questionsResponseSchema = z.object({
  data: z.array(questionItemSchema),
  pagination: z.object({ page: z.number(), limit: z.number(), total: z.number() }),
});

export type QuestionItem = z.infer<typeof questionItemSchema>;

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
    const body = res.ok ? await parseJson(res, questionsResponseSchema) : null;
    if (body) {
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
