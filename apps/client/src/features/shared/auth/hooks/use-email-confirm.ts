'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { useEffect, useState } from 'react';
import type { AuthFlowError, AuthSession } from '@/features/shared/auth/types';
import { createApiClient } from '@/lib/api';
import { setTokens } from '@/lib/auth';

/**
 * メールリンク（Supabase verifyOtp）の確定処理（端末非依存）。
 *
 * リンク URL を Supabase ドメインではなく自社ドメインに集約することで、
 * Microsoft (Outlook) の SmartScreen サイレント破棄を回避している。
 * 想定 URL: /auth/confirm?token_hash=...&type=signup&next=/entries/new
 *
 * Issue #490: 通信を page から切り出し、page は文言を描くだけにした。
 */

const VALID_TYPES = ['signup', 'invite', 'magiclink', 'recovery', 'email_change'] as const;
type EmailOtpType = (typeof VALID_TYPES)[number];

function isEmailOtpType(value: string): value is EmailOtpType {
  return VALID_TYPES.some((type) => type === value);
}

/**
 * 種別ごとの既定遷移先（`next` が無いとき）。
 *
 * 既定が `/` なのは、ホームがどこか（書斎か従来の入口か）を知っているのが
 * `HomeGate`（= `useHomeHref`）1 か所だから。ここで `/entries/new` と書くと、
 * 書斎ホームが有効な人だけ着地が食い違う。
 */
function defaultNextFor(type: EmailOtpType): string {
  switch (type) {
    case 'recovery':
      return '/reset-password';
    case 'email_change':
      return '/account';
    default:
      return '/';
  }
}

/**
 * `session` の**中身**まで検証する。直後に `data.session.accessToken` を読むので、
 * オブジェクトの有無だけでは TypeError を防げない（未処理 rejection になり
 * `setError` にも到達せず画面が固まる）。
 */
function isAuthSession(value: unknown): value is AuthSession {
  if (typeof value !== 'object' || value === null) return false;
  if (!('user' in value) || typeof value.user !== 'object' || value.user === null) return false;
  if (!('id' in value.user) || typeof value.user.id !== 'string') return false;
  if (!('session' in value) || typeof value.session !== 'object' || value.session === null) {
    return false;
  }
  const { session } = value;
  if (!('accessToken' in session) || typeof session.accessToken !== 'string') return false;
  return 'refreshToken' in session && typeof session.refreshToken === 'string';
}

export function useEmailConfirm(): { error: AuthFlowError | null } {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<AuthFlowError | null>(null);

  useEffect(() => {
    async function handle() {
      // Supabase が hash でエラーを返したケース（期限切れ・使用済みリンク）。
      // ルート（/）の HomeGate がここへ回してくるので、通信はせず理由だけ見せる。
      if (searchParams.get('auth_error')) {
        setError('auth_failed');
        return;
      }

      const tokenHash = searchParams.get('token_hash');
      const typeParam = searchParams.get('type');
      const next = searchParams.get('next');

      if (!tokenHash || !typeParam || !isEmailOtpType(typeParam)) {
        setError('invalid_link');
        return;
      }

      const res = await createApiClient().fetch('/api/v1/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ tokenHash, type: typeParam }),
      });
      if (!res.ok) {
        setError('auth_failed');
        return;
      }

      const data: unknown = await res.json();
      if (!isAuthSession(data)) {
        setError('auth_failed');
        return;
      }

      setTokens(data.session.accessToken, data.session.refreshToken);
      posthog.identify(data.user.id, { email: data.user.email });
      router.push(next ?? defaultNextFor(typeParam));
    }
    handle();
  }, [searchParams, router]);

  return { error };
}
