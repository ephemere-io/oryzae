'use client';

import posthog from 'posthog-js';
import { useEffect, useState } from 'react';
import { type ApiClient, createApiClient, tryRefreshToken } from '@/lib/api';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '@/lib/auth';

interface AuthState {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    nickname: string | null;
    avatarUrl: string | null;
    name: string | null;
    providers: string[];
  };
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

      // Issue #362: api を即セット（楽観的）。auth/me 検証の完了を待たず
      // データ取得を並行開始できるようにする。失効していても下の refresh で
      // 復旧し、データ取得側も createApiClient の 401→refresh→retry で自己修復する。
      const client = createApiClient(token);
      setApi(client);

      const meRes = await client.fetch('/api/v1/auth/me');

      if (meRes.ok) {
        const data = (await meRes.json()) as {
          user: {
            id: string;
            email: string;
            nickname: string | null;
            avatarUrl: string | null;
            name: string | null;
            providers: string[];
          };
        };
        setAuth({ accessToken: token, refreshToken: getRefreshToken() ?? '', user: data.user });
        posthog.identify(data.user.id, { email: data.user.email });
        setLoading(false);
        return;
      }

      // Access token expired — refresh は lib/api の共有シングルトン経由で
      // 1本に集約する（楽観取得で並発する 401 と二重リフレッシュしない）。
      const newToken = await tryRefreshToken();
      if (!newToken) {
        // refresh token が無い/失効。トークンを破棄して未認証状態にする
        // （tryRefreshToken はリクエスト失敗時のみ clear するため、ここで冪等に補う）。
        clearTokens();
        setApi(null);
        setLoading(false);
        return;
      }

      const newClient = createApiClient(newToken);
      setApi(newClient);
      const retryRes = await newClient.fetch('/api/v1/auth/me');

      if (retryRes.ok) {
        const userData = (await retryRes.json()) as {
          user: {
            id: string;
            email: string;
            nickname: string | null;
            avatarUrl: string | null;
            name: string | null;
            providers: string[];
          };
        };
        setAuth({
          accessToken: newToken,
          refreshToken: getRefreshToken() ?? '',
          user: userData.user,
        });
        posthog.identify(userData.user.id, { email: userData.user.email });
      } else {
        clearTokens();
        setApi(null);
      }

      setLoading(false);
    }

    restoreSession();
  }, []);

  async function login(identifier: string, password: string): Promise<string | null> {
    const client = createApiClient();
    const res = await client.fetch('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error: string };
      return data.error;
    }
    const data = (await res.json()) as {
      user: {
        id: string;
        email: string;
        nickname: string | null;
        avatarUrl: string | null;
        name: string | null;
        providers: string[];
      };
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

  async function signup(
    nickname: string,
    email: string,
    password: string,
    locale?: 'ja' | 'en' | 'zh' | 'ko',
  ): Promise<string | null> {
    const client = createApiClient();
    // Supabase の確認メールに埋め込む redirect 先を、フォームが置かれている origin に
    // 揃える。Vercel preview ではこれを送らないとダッシュボード設定の本番 Site URL に
    // 戻ってしまい、preview 環境での新規サインアップ動作確認ができない。
    const emailRedirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/auth/confirm` : undefined;
    const res = await client.fetch('/api/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ nickname, email, password, locale, emailRedirectTo }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error: string };
      return data.error;
    }
    const data = (await res.json()) as {
      user: {
        id: string;
        email: string;
        nickname: string | null;
        avatarUrl: string | null;
        name: string | null;
        providers: string[];
      };
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
