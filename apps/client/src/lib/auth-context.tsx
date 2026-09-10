'use client';

import posthog from 'posthog-js';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { type ApiClient, createApiClient, tryRefreshToken } from '@/lib/api';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '@/lib/auth';
import { clearAllStaleCaches } from '@/lib/stale-cache';

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

type User = AuthState['user'];

interface Session {
  accessToken: string;
  refreshToken: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** API レスポンス(res.json() は型なし)から user を検証して narrow する（`as` を使わない）。 */
function parseUser(json: unknown): User | null {
  if (!isRecord(json) || !isRecord(json.user)) return null;
  const u = json.user;
  if (typeof u.id !== 'string' || typeof u.email !== 'string') return null;
  return {
    id: u.id,
    email: u.email,
    nickname: typeof u.nickname === 'string' ? u.nickname : null,
    avatarUrl: typeof u.avatarUrl === 'string' ? u.avatarUrl : null,
    name: typeof u.name === 'string' ? u.name : null,
    providers: Array.isArray(u.providers)
      ? u.providers.filter((p): p is string => typeof p === 'string')
      : [],
  };
}

/** ログイン/サインアップ応答の session を検証。確認メール待ち等で無ければ null。 */
function parseSession(json: unknown): Session | null {
  if (!isRecord(json) || !isRecord(json.session)) return null;
  const s = json.session;
  if (typeof s.accessToken !== 'string' || typeof s.refreshToken !== 'string') return null;
  return { accessToken: s.accessToken, refreshToken: s.refreshToken };
}

/** エラー応答から error 文字列を取り出す（無ければ汎用文言）。 */
function parseErrorMessage(json: unknown): string {
  return isRecord(json) && typeof json.error === 'string' ? json.error : 'Unknown error';
}

export interface AuthContextValue {
  auth: AuthState | null;
  api: ApiClient | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<string | null>;
  signup: (
    nickname: string,
    email: string,
    password: string,
    locale?: 'ja' | 'en' | 'zh' | 'ko',
  ) => Promise<string | null>;
  logout: () => void;
}

// AuthContext は検証ハーネス(withVerifyProviders)が mock 値を供給するため export する。
// 実コードは必ず useAuth 経由で読む（直接 import しない）。
export const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * 認証は **アプリ全体で1インスタンス**にする（root layout に Provider を置く）。
 * 以前は各コンポーネント/ページが useAuth() を呼ぶたびに restoreSession が走り、
 * `/auth/me` を重複発行していた（特に App Router はページ遷移ごとに page が再マウント
 * されるため毎遷移で再取得）。Context 化でセッション復元はセッション中1回に集約する。
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
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
        const user = parseUser(await meRes.json());
        if (user) {
          setAuth({ accessToken: token, refreshToken: getRefreshToken() ?? '', user });
          posthog.identify(user.id, { email: user.email });
          setLoading(false);
          return;
        }
        // 200 だが想定外の body → 下の refresh パスへフォールバック。
      }

      // Access token expired — refresh は lib/api の共有シングルトン経由で
      // 1本に集約する（楽観取得で並発する 401 と二重リフレッシュしない）。
      const newToken = await tryRefreshToken();
      if (!newToken) {
        clearTokens();
        setApi(null);
        setLoading(false);
        return;
      }

      const newClient = createApiClient(newToken);
      setApi(newClient);
      const retryRes = await newClient.fetch('/api/v1/auth/me');

      const user = retryRes.ok ? parseUser(await retryRes.json()) : null;
      if (user) {
        setAuth({
          accessToken: newToken,
          refreshToken: getRefreshToken() ?? '',
          user,
        });
        posthog.identify(user.id, { email: user.email });
      } else {
        clearTokens();
        setApi(null);
      }

      setLoading(false);
    }

    restoreSession();
  }, []);

  const login = useCallback(
    async (identifier: string, password: string): Promise<string | null> => {
      const client = createApiClient();
      const res = await client.fetch('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });
      if (!res.ok) {
        return parseErrorMessage(await res.json());
      }
      const json = await res.json();
      const user = parseUser(json);
      const session = parseSession(json);
      if (!user || !session) return 'Unknown error';
      setTokens(session.accessToken, session.refreshToken);
      setAuth({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        user,
      });
      setApi(createApiClient(session.accessToken));
      posthog.identify(user.id, { email: user.email });
      return null;
    },
    [],
  );

  const signup = useCallback(
    async (
      nickname: string,
      email: string,
      password: string,
      locale?: 'ja' | 'en' | 'zh' | 'ko',
    ): Promise<string | null> => {
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
        return parseErrorMessage(await res.json());
      }
      const json = await res.json();
      const user = parseUser(json);
      const session = parseSession(json); // 確認メール待ちでは null
      if (user && session) {
        setTokens(session.accessToken, session.refreshToken);
        setAuth({
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          user,
        });
        setApi(createApiClient(session.accessToken));
      }
      return null;
    },
    [],
  );

  const logout = useCallback(() => {
    clearTokens();
    setAuth(null);
    setApi(null);
    posthog.reset();
    // 憶えてある画面の中身（記録の冒頭・発酵の言葉・貼ったカード）を捨てる。
    // 共有端末で次に使う人へ持ち越さない。
    clearAllStaleCaches();
  }, []);

  const value: AuthContextValue = { auth, api, loading, login, signup, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** アプリ全体で共有される認証状態を読む。Provider は root layout に1つ。 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth は <AuthProvider> の内側で使う必要があります');
  }
  return ctx;
}
