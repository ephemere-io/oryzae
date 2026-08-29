'use client';

import { useEffect, useState } from 'react';
import { z } from 'zod';
import { type ApiClient, createApiClient, tryRefreshToken } from '@/lib/api';
import { clearTokens, getAccessToken, setTokens } from '@/lib/auth';
import { parseJson, readErrorMessage } from '@/lib/json';

const authUserSchema = z.object({ id: z.string(), email: z.string() });

const meResponseSchema = z.object({ user: authUserSchema });

const loginResponseSchema = z.object({
  user: authUserSchema,
  session: z.object({ accessToken: z.string(), refreshToken: z.string() }),
});

interface AdminAuthState {
  accessToken: string;
  user: z.infer<typeof authUserSchema>;
}

async function verifyAdminAndGetUser(
  token: string,
): Promise<z.infer<typeof authUserSchema> | null> {
  const client = createApiClient(token);
  const adminRes = await client.fetch('/api/v1/admin/dashboard/stats');
  if (!adminRes.ok) return null;

  const meRes = await client.fetch('/api/v1/auth/me');
  if (!meRes.ok) return null;

  const meData = await parseJson(meRes, meResponseSchema);
  return meData?.user ?? null;
}

export function useAdminAuth() {
  const [auth, setAuth] = useState<AdminAuthState | null>(null);
  const [api, setApi] = useState<ApiClient | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      // 1. Try existing access token
      const token = getAccessToken();
      if (token) {
        const user = await verifyAdminAndGetUser(token);
        if (user) {
          setAuth({ accessToken: token, user });
          setApi(createApiClient(token));
          setLoading(false);
          return;
        }
      }

      // 2. Access token expired or missing — try refresh
      // Issue #362: refresh は lib/api の共有シングルトン経由で1本に集約する
      // （mount-gate でデータフックと検証が同時に refresh しても二重実行しない）。
      const newToken = await tryRefreshToken();
      if (newToken) {
        const user = await verifyAdminAndGetUser(newToken);
        if (user) {
          setAuth({ accessToken: newToken, user });
          setApi(createApiClient(newToken));
          setLoading(false);
          return;
        }
      }

      // 3. Both failed — clear and require login
      clearTokens();
      setLoading(false);
    }

    restoreSession();
  }, []);

  async function login(email: string, password: string): Promise<string | null> {
    const client = createApiClient();
    const res = await client.fetch('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: email, password }),
    });
    if (!res.ok) {
      return await readErrorMessage(res, 'ログインに失敗しました');
    }
    const data = await parseJson(res, loginResponseSchema);
    if (!data) return 'ログインに失敗しました（応答の形式が不正です）';

    // Verify admin access
    const adminClient = createApiClient(data.session.accessToken);
    const adminRes = await adminClient.fetch('/api/v1/admin/dashboard/stats');
    if (!adminRes.ok) {
      return '管理者権限がありません';
    }

    setTokens(data.session.accessToken, data.session.refreshToken);
    setAuth({ accessToken: data.session.accessToken, user: data.user });
    setApi(adminClient);
    return null;
  }

  function logout() {
    clearTokens();
    setAuth(null);
    setApi(null);
  }

  return { auth, api, loading, login, logout };
}
