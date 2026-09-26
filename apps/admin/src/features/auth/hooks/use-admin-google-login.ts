'use client';

import { useCallback } from 'react';
import { z } from 'zod';
import { createApiClient } from '@/lib/api';
import { clearTokens, setTokens } from '@/lib/auth';
import { parseJson } from '@/lib/json';

/**
 * 管理画面の Google ログイン。クライアントアプリと同じサーバーの OAuth 経路を使う。
 *
 *   1. start: `/api/v1/auth/oauth/google` で Google の認可 URL をもらい、そこへ移る
 *   2. Google → Supabase → `/auth/callback` に戻ってくる
 *   3. complete: 戻り先の URL のハッシュからトークンを取り出し、管理者かどうかを確かめてから保存する
 *
 * **`/oauth/finalize` は呼ばない。** あれはクライアントアプリの新規登録（プロフィール作成・
 * 登録枠のチェック）のためのもので、管理画面から呼ぶと、管理者でない Google アカウントで
 * 押しただけでアプリの利用者が 1 人増えてしまう。
 */

const oauthStartSchema = z.object({ url: z.string() });

/** Google から戻る先。Supabase の Redirect URLs にこの形の URL を許可しておくこと。 */
export function adminOAuthRedirectUrl(origin: string): string {
  return `${origin}/auth/callback`;
}

function parseHash(hash: string): URLSearchParams {
  return new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
}

/**
 * 戻り先 URL のハッシュ（#access_token=…&refresh_token=…）からトークンを取り出す。
 *
 * Supabase JS の signInWithOAuth は既定で implicit flow なので、トークンはハッシュで返る。
 * PKCE（?code=）の交換口 `/oauth/callback` はプロフィールを作ってしまうので使わない。
 */
function readTokens(
  location: Pick<Location, 'hash'>,
): { accessToken: string; refreshToken: string } | null {
  const hash = parseHash(location.hash);
  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  return accessToken && refreshToken ? { accessToken, refreshToken } : null;
}

export function useAdminGoogleLogin() {
  /** Google の認可 URL。取れなければエラー文言を返す。 */
  const startGoogleLogin = useCallback(async (): Promise<{ url: string } | { error: string }> => {
    const res = await createApiClient().fetch('/api/v1/auth/oauth/google', {
      method: 'POST',
      body: JSON.stringify({ redirectTo: adminOAuthRedirectUrl(window.location.origin) }),
    });
    const data = res.ok ? await parseJson(res, oauthStartSchema) : null;
    return data ? { url: data.url } : { error: 'Google ログインを始められませんでした' };
  }, []);

  /** 戻ってきた URL を確定させる。成功なら null、失敗ならエラー文言。 */
  const completeGoogleLogin = useCallback(
    async (location: Pick<Location, 'hash'>): Promise<string | null> => {
      const errorDescription = parseHash(location.hash).get('error_description');
      if (errorDescription) return `Google ログインに失敗しました: ${errorDescription}`;

      const tokens = readTokens(location);
      if (!tokens) return 'Google ログインに失敗しました（トークンを受け取れませんでした）';

      // 管理者でなければトークンを残さない（管理画面に中途半端なログイン状態を作らない）。
      const adminRes = await createApiClient(tokens.accessToken).fetch(
        '/api/v1/admin/dashboard/stats',
      );
      if (!adminRes.ok) {
        clearTokens();
        return 'このアカウントには管理者権限がありません';
      }
      setTokens(tokens.accessToken, tokens.refreshToken);
      return null;
    },
    [],
  );

  return { startGoogleLogin, completeGoogleLogin };
}
