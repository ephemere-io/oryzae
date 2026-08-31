'use client';

import { useCallback, useMemo } from 'react';
import type { AccountUpdateResult } from '@/features/shared/account/types';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

/**
 * アカウント更新（プロフィール / メール / パスワード）の共有 API（端末非依存）。
 *
 * Issue #490: PC の AccountPage と SP の SpAccountPage が、同じ
 * `PATCH /api/v1/auth/profile` をそれぞれコンポーネント内で直叩きしていた
 * （SP 側のコメントに「features/auth(flat) への越境 import を避ける」と書かれていた＝
 * 置き場が非対称だったせいでコピーが生まれた）。ここに1本化する。
 *
 * トークンは `getAccessToken()` から都度読む（auth-context の api ではなく）。
 * アカウント操作は再認証直後に呼ばれることがあり、context の更新を待たずに
 * 最新トークンで撃ちたいため。既存挙動をそのまま維持している。
 */
async function send(
  method: 'POST' | 'PATCH',
  path: string,
  body: unknown,
): Promise<AccountUpdateResult> {
  const token = getAccessToken();
  if (!token) return { ok: false, kind: 'unauthenticated' };

  const api = createApiClient(token);
  const res = await api.fetch(path, { method, body: JSON.stringify(body) });
  if (res.ok) return { ok: true };

  const data: unknown = await res.json();
  const error =
    typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string'
      ? data.error
      : '';
  return { ok: false, kind: 'server', error };
}

export function useAccountApi() {
  const updateProfile = useCallback(
    (field: string, value: string): Promise<AccountUpdateResult> =>
      send('PATCH', '/api/v1/auth/profile', { [field]: value }),
    [],
  );

  const changeEmail = useCallback(
    (newEmail: string): Promise<AccountUpdateResult> =>
      send('POST', '/api/v1/auth/change-email', { newEmail }),
    [],
  );

  const changePassword = useCallback(
    (currentPassword: string, newPassword: string): Promise<AccountUpdateResult> =>
      send('POST', '/api/v1/auth/change-password', { currentPassword, newPassword }),
    [],
  );

  return useMemo(
    () => ({ updateProfile, changeEmail, changePassword }),
    [updateProfile, changeEmail, changePassword],
  );
}
