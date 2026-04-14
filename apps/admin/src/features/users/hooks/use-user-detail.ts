'use client';

import { useCallback, useEffect, useState } from 'react';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

export interface UserProfile {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
}

export interface UserEntry {
  id: string;
  characterCount: number;
  createdAt: string;
}

export interface UserQuestion {
  id: string;
  text: string;
  isArchived: boolean;
  createdAt: string;
}

export interface UserFermentation {
  id: string;
  status: string;
  errorMessage: string | null;
  hasGenerationId: boolean;
  createdAt: string;
}

export interface EntryDate {
  date: string;
  count: number;
}

export interface UserDetailResponse {
  profile: UserProfile;
  entries: UserEntry[];
  questions: UserQuestion[];
  fermentations: UserFermentation[];
  entryDates: EntryDate[];
}

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
    if (res.ok) {
      const json = (await res.json()) as UserDetailResponse;
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
