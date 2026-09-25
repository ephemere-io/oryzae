'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { AuthFlowError, AuthSession } from '@/features/shared/auth/types';
import { createApiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

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
 * 既定が `/` なのは、`/` が書斎そのもので、書斎を止めていれば従来の入口へ送るから
 * （`app/(protected)/page.tsx`）。ここで `/entries/new` と書くと、書斎の人だけ着地が
 * 食い違う。
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

export function useEmailConfirm(
  /**
   * 行き先へ読み込み直す**直前**に待つもの（認証画面の扉を開けて入る演出）。
   * 行き先を受け取り、解決したら移る。失敗しても移る — 演出のために入口を塞がない。
   */
  beforeLeave?: (destination: string) => Promise<void>,
): { error: AuthFlowError | null } {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { adoptSession } = useAuth();
  const [error, setError] = useState<AuthFlowError | null>(null);
  // effect を searchParams だけで回すため、関数は ref で読む（毎描画で新しい参照になりうる）。
  const beforeLeaveRef = useRef(beforeLeave);
  beforeLeaveRef.current = beforeLeave;
  const adoptRef = useRef(adoptSession);
  adoptRef.current = adoptSession;
  const pushRef = useRef(router.push);
  pushRef.current = router.push;

  useEffect(() => {
    async function handle() {
      // Supabase が hash でエラーを返したケース（期限切れ・使用済みリンク）。
      // ルート（/）が hash を読んでここへ回してくるので、通信はせず理由だけ見せる。
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

      // 文脈に載せる。載れば読み込み直さずに入れる（`AuthContextValue.adoptSession`）。
      // 以前は必ず読み込み直していた — 復元は mount 時にしか走らないので、アプリ内の
      // 遷移で保護画面へ入ると「未ログイン」に見えてログイン画面へ戻されていた。
      const adopted = adoptRef.current(data);
      const destination = next ?? defaultNextFor(typeParam);
      await beforeLeaveRef.current?.(destination).catch(() => undefined);
      if (adopted) pushRef.current(destination);
      else window.location.assign(destination);
    }
    handle();
  }, [searchParams]);

  return { error };
}
