'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import posthog from 'posthog-js';
import { Suspense, useEffect, useState } from 'react';
import { createApiClient } from '@/lib/api';
import { setTokens } from '@/lib/auth';

function parseHashParams(hash: string): Record<string, string> {
  const params: Record<string, string> = {};
  const stripped = hash.startsWith('#') ? hash.slice(1) : hash;
  for (const pair of stripped.split('&')) {
    const [key, value] = pair.split('=');
    if (key && value) {
      params[decodeURIComponent(key)] = decodeURIComponent(value);
    }
  }
  return params;
}

function CallbackHandler() {
  const t = useTranslations('auth.callback');
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    async function handleCallback() {
      // Supabase PKCE flow: code in query params
      const code = searchParams.get('code');
      if (code) {
        const client = createApiClient();
        const res = await client.fetch('/api/v1/auth/oauth/callback', {
          method: 'POST',
          body: JSON.stringify({ code }),
        });

        if (!res.ok) {
          setError(t('error_auth_failed'));
          return;
        }

        const data = (await res.json()) as {
          user: { id: string; email: string };
          session: { accessToken: string; refreshToken: string };
        };

        setTokens(data.session.accessToken, data.session.refreshToken);
        posthog.identify(data.user.id, { email: data.user.email });
        router.push('/entries');
        return;
      }

      // Supabase implicit flow: tokens in URL hash fragment
      const hash = window.location.hash;
      if (hash) {
        const params = parseHashParams(hash);
        const accessToken = params.access_token;
        const refreshToken = params.refresh_token;

        if (accessToken && refreshToken) {
          setTokens(accessToken, refreshToken);

          // Verify token and get user info
          const client = createApiClient(accessToken);
          const meRes = await client.fetch('/api/v1/auth/me');

          if (meRes.ok) {
            const data = (await meRes.json()) as { user: { id: string; email: string } };
            posthog.identify(data.user.id, { email: data.user.email });
          }

          router.push('/entries');
          return;
        }
      }

      setError(t('error_no_code'));
    }

    handleCallback();
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

  return <p className="text-sm text-center text-zinc-500">{t('authenticating')}</p>;
}

function CallbackFallback() {
  const t = useTranslations('auth.callback');
  return <p className="text-sm text-center text-zinc-500">{t('loading')}</p>;
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<CallbackFallback />}>
      <CallbackHandler />
    </Suspense>
  );
}
