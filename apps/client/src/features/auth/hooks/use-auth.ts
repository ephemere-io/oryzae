'use client';

import { useEffect, useState } from 'react';
import { type ApiClient, createApiClient } from '@/lib/api';
import { clearTokens, getAccessToken, setTokens } from '@/lib/auth';

interface AuthState {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string };
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [api, setApi] = useState<ApiClient | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      const client = createApiClient(token);
      setApi(client);
      client
        .fetch('/api/v1/auth/me')
        .then(async (res) => {
          if (res.ok) {
            const data = (await res.json()) as { user: { id: string; email: string } };
            setAuth({ accessToken: token, refreshToken: '', user: data.user });
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
    setTokens(data.session.accessToken, data.session.refreshToken);
    setAuth({
      accessToken: data.session.accessToken,
      refreshToken: data.session.refreshToken,
      user: data.user,
    });
    setApi(createApiClient(data.session.accessToken));
    return null;
  }

  async function signup(email: string, password: string): Promise<string | null> {
    const client = createApiClient();
    const res = await client.fetch('/api/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error: string };
      return data.error;
    }
    const data = (await res.json()) as {
      user: { id: string; email: string };
      session: { accessToken: string; refreshToken: string } | null;
    };
    if (data.session) {
      setTokens(data.session.accessToken, data.session.refreshToken);
      setAuth({
        accessToken: data.session.accessToken,
        refreshToken: data.session.refreshToken,
        user: data.user,
      });
      setApi(createApiClient(data.session.accessToken));
    }
    return null;
  }

  function logout() {
    clearTokens();
    setAuth(null);
    setApi(null);
  }

  return { auth, api, loading, login, signup, logout };
}
