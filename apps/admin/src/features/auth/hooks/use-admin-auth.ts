'use client';

import { useEffect, useState } from 'react';
import { type ApiClient, createApiClient } from '@/lib/api';
import { clearTokens, getAccessToken, setTokens } from '@/lib/auth';

interface AdminAuthState {
  accessToken: string;
  user: { id: string; email: string };
}

export function useAdminAuth() {
  const [auth, setAuth] = useState<AdminAuthState | null>(null);
  const [api, setApi] = useState<ApiClient | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      const client = createApiClient(token);
      setApi(client);
      // Verify token by calling an admin endpoint
      client
        .fetch('/api/v1/admin/dashboard/stats')
        .then(async (res) => {
          if (res.ok) {
            // Token is valid and user is admin
            const meRes = await client.fetch('/api/v1/auth/me');
            if (meRes.ok) {
              const meData = (await meRes.json()) as { user: { id: string; email: string } };
              setAuth({ accessToken: token, user: meData.user });
            } else {
              clearTokens();
            }
          } else {
            clearTokens();
          }
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(email: string, password: string): Promise<string | null> {
    const client = createApiClient();
    const res = await client.fetch('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
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
