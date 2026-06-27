'use client';

import { useEffect, useState } from 'react';
import { type ApiClient, createApiClient, tryRefreshToken } from '@/lib/api';
import { clearTokens, getAccessToken, setTokens } from '@/lib/auth';

interface AdminAuthState {
  accessToken: string;
  user: { id: string; email: string };
}

async function verifyAdminAndGetUser(token: string): Promise<{ id: string; email: string } | null> {
  const client = createApiClient(token);
  const adminRes = await client.fetch('/api/v1/admin/dashboard/stats');
  if (!adminRes.ok) return null;

  const meRes = await client.fetch('/api/v1/auth/me');
  if (!meRes.ok) return null;

  const meData = (await meRes.json()) as { user: { id: string; email: string } };
  return meData.user;
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
      const data = (await res.json()) as { error: string };
      return data.error;
    }
    const data = (await res.json()) as {
      user: { id: string; email: string };
      session: { accessToken: string; refreshToken: string };
    };

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
