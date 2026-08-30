'use client';

import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { parseJson } from '@/lib/json';

const adminUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  createdAt: z.string(),
  lastSignInAt: z.string().nullable(),
  entryCount: z.number(),
  questionCount: z.number(),
  fermentationTotal: z.number(),
  fermentationCompleted: z.number(),
  fermentationFailed: z.number(),
});

const usersResponseSchema = z.object({ users: z.array(adminUserSchema) });

export type AdminUser = z.infer<typeof adminUserSchema>;

export function useUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    const api = createApiClient(token);
    const res = await api.fetch('/api/v1/admin/users');
    const data = res.ok ? await parseJson(res, usersResponseSchema) : null;
    if (data) {
      setUsers(data.users);
    } else {
      setError('ユーザー情報の取得に失敗しました');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return { users, loading, error, refresh: fetchUsers };
}
