'use client';

import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { parseJson } from '@/lib/json';

const userProfileSchema = z.object({
  id: z.string(),
  email: z.string(),
  createdAt: z.string(),
  lastSignInAt: z.string().nullable(),
});

const userEntrySchema = z.object({
  id: z.string(),
  characterCount: z.number(),
  createdAt: z.string(),
});

const userQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  isArchived: z.boolean(),
  createdAt: z.string(),
});

const userFermentationSchema = z.object({
  id: z.string(),
  status: z.string(),
  errorMessage: z.string().nullable(),
  hasGenerationId: z.boolean(),
  createdAt: z.string(),
});

const entryDateSchema = z.object({
  date: z.string(),
  count: z.number(),
});

const userDetailResponseSchema = z.object({
  profile: userProfileSchema,
  entries: z.array(userEntrySchema),
  questions: z.array(userQuestionSchema),
  fermentations: z.array(userFermentationSchema),
  entryDates: z.array(entryDateSchema),
});

export type UserProfile = z.infer<typeof userProfileSchema>;
export type UserEntry = z.infer<typeof userEntrySchema>;
export type UserQuestion = z.infer<typeof userQuestionSchema>;
export type UserFermentation = z.infer<typeof userFermentationSchema>;
export type EntryDate = z.infer<typeof entryDateSchema>;
export type UserDetailResponse = z.infer<typeof userDetailResponseSchema>;

export function useUserDetail(userId: string) {
  const [data, setData] = useState<UserDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserDetail = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    const api = createApiClient(token);
    const res = await api.fetch(`/api/v1/admin/users/${userId}`);
    const json = res.ok ? await parseJson(res, userDetailResponseSchema) : null;
    if (json) {
      setData(json);
    } else {
      setError('ユーザー詳細の取得に失敗しました');
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchUserDetail();
  }, [fetchUserDetail]);

  return { data, loading, error, refresh: fetchUserDetail };
}
