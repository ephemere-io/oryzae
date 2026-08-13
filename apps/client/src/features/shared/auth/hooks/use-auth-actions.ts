'use client';

import { useCallback, useMemo } from 'react';
import type { AuthActionResult } from '@/features/shared/auth/types';
import { createApiClient } from '@/lib/api';

/**
 * 認証フォームが撃つ操作（端末非依存）。
 *
 * Issue #490: パスワード再設定・更新・Google OAuth の開始が、それぞれのフォーム
 * コンポーネント内で `createApiClient()` を直叩きしていた。fetch は features/shared に
 * 集約する不変条件に合わせてここへ移す。文言は呼び出し側が `translateAuthError` で解決
 * するため、hook はサーバーのエラーコードをそのまま返す。
 */

async function send(path: string, body: unknown): Promise<AuthActionResult> {
  const res = await createApiClient().fetch(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (res.ok) return { ok: true };

  const data: unknown = await res.json().catch(() => ({}));
  const error =
    typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string'
      ? data.error
      : '';
  return { ok: false, error };
}

export function useAuthActions() {
  /** 再設定メールを送る。`redirectTo` はメール内リンクの戻り先。 */
  const requestPasswordReset = useCallback(
    (email: string, redirectTo: string): Promise<AuthActionResult> =>
      send('/api/v1/auth/reset-password', { email, redirectTo }),
    [],
  );

  /** 再設定リンクで得たトークンを使って新しいパスワードを確定する。 */
  const updatePassword = useCallback(
    (accessToken: string, password: string): Promise<AuthActionResult> =>
      send('/api/v1/auth/update-password', { accessToken, password }),
    [],
  );

  /**
   * Google OAuth の認可 URL を取得する。取得できなければ null
   * （呼び出し側はボタンの loading を戻すだけで、文言は出さない既存挙動を維持）。
   */
  const startGoogleOauth = useCallback(
    async (redirectTo: string, locale: string): Promise<string | null> => {
      const res = await createApiClient().fetch('/api/v1/auth/oauth/google', {
        method: 'POST',
        body: JSON.stringify({ redirectTo, locale }),
      });
      if (!res.ok) return null;
      const data: unknown = await res.json();
      if (typeof data !== 'object' || data === null || !('url' in data)) return null;
      return typeof data.url === 'string' ? data.url : null;
    },
    [],
  );

  return useMemo(
    () => ({ requestPasswordReset, updatePassword, startGoogleOauth }),
    [requestPasswordReset, updatePassword, startGoogleOauth],
  );
}
