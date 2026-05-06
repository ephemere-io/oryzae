'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import posthog from 'posthog-js';
import { Suspense, useEffect, useState } from 'react';
import { createApiClient } from '@/lib/api';
import { setTokens } from '@/lib/auth';

/**
 * Supabase メールテンプレートからのリンクを受けて Supabase verifyOtp を叩く。
 * リンク URL を Supabase ドメインではなく自社ドメインに集約することで、
 * Microsoft (Outlook) の SmartScreen サイレント破棄を回避する。
 *
 * 想定 URL: /auth/confirm?token_hash=...&type=signup&next=/entries/new
 */

const VALID_TYPES = ['signup', 'invite', 'magiclink', 'recovery', 'email_change'] as const;
type EmailOtpType = (typeof VALID_TYPES)[number];

function isEmailOtpType(value: string): value is EmailOtpType {
  return (VALID_TYPES as readonly string[]).includes(value);
}

function defaultNextFor(type: EmailOtpType): string {
  switch (type) {
    case 'recovery':
      return '/reset-password';
    case 'email_change':
      return '/account';
    default:
      return '/entries/new';
  }
}

function ConfirmHandler() {
  const t = useTranslations('auth.confirm');
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    async function handle() {
      const tokenHash = searchParams.get('token_hash');
      const typeParam = searchParams.get('type');
      const next = searchParams.get('next');

      if (!tokenHash || !typeParam || !isEmailOtpType(typeParam)) {
        setError(t('error_invalid_link'));
        return;
      }
      const type = typeParam;

      const client = createApiClient();
      const res = await client.fetch('/api/v1/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ tokenHash, type }),
      });

      if (!res.ok) {
        setError(t('error_failed'));
        return;
      }

      const data = (await res.json()) as {
        user: { id: string; email: string };
        session: { accessToken: string; refreshToken: string };
      };

      setTokens(data.session.accessToken, data.session.refreshToken);
      posthog.identify(data.user.id, { email: data.user.email });
      router.push(next ?? defaultNextFor(type));
    }
    handle();
  }, [searchParams, router, t]);

  if (error) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
        <a href="/login" className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {t('back_to_login')}
        </a>
      </div>
    );
  }

  return <p className="text-sm text-center text-zinc-500">{t('processing')}</p>;
}

function ConfirmFallback() {
  const t = useTranslations('auth.confirm');
  return <p className="text-sm text-center text-zinc-500">{t('processing')}</p>;
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<ConfirmFallback />}>
      <ConfirmHandler />
    </Suspense>
  );
}
