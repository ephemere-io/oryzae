'use client';

import posthog from 'posthog-js';
import { useEffect, useState } from 'react';
import { type ApiClient, createApiClient } from '@/lib/api';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '@/lib/auth';

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
    async function restoreSession() {
      const token = getAccessToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const client = createApiClient(token);
      const meRes = await client.fetch('/api/v1/auth/me');

      if (meRes.ok) {
        const data = (await meRes.json()) as { user: { id: string; email: string } };
        setAuth({ accessToken: token, refreshToken: getRefreshToken() ?? '', user: data.user });
        setApi(client);
        posthog.identify(data.user.id, { email: data.user.email });
        setLoading(false);
        return;
      }

      // Access token expired — try refresh
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        clearTokens();
        setLoading(false);
        return;
      }

      const refreshRes = await createApiClient().fetch('/api/v1/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });

      if (!refreshRes.ok) {
        clearTokens();
        setLoading(false);
        return;
      }

      const refreshData = (await refreshRes.json()) as {
        session: { accessToken: string; refreshToken: string };
      };
      setTokens(refreshData.session.accessToken, refreshData.session.refreshToken);

      const newClient = createApiClient(refreshData.session.accessToken);
      const retryRes = await newClient.fetch('/api/v1/auth/me');

      if (retryRes.ok) {
        const userData = (await retryRes.json()) as { user: { id: string; email: string } };
        setAuth({
          accessToken: refreshData.session.accessToken,
          refreshToken: refreshData.session.refreshToken,
          user: userData.user,
        });
        setApi(newClient);
        posthog.identify(userData.user.id, { email: userData.user.email });
      } else {
        clearTokens();
      }

      setLoading(false);
    }

    restoreSession();
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
    posthog.identify(data.user.id, { email: data.user.email });
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
    posthog.reset();
  }

  return { auth, api, loading, login, signup, logout };
}
