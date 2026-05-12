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
  const tErr = useTranslations('auth.error');
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    async function handleCallback() {
      // Supabase PKCE flow: code in query params.
      // locale はサインアップフォーム / GoogleLoginButton から redirectTo 経由で運ばれてきた値。
      // 初回 OAuth サインインで user_metadata.locale を保存するために、サーバーへ伝搬する。
      const code = searchParams.get('code');
      if (code) {
        const localeParam = searchParams.get('locale');
        const locale = localeParam === 'ja' || localeParam === 'en' ? localeParam : undefined;
        const client = createApiClient();
        const res = await client.fetch('/api/v1/auth/oauth/callback', {
          method: 'POST',
          body: JSON.stringify({ code, locale }),
        });

        if (!res.ok) {
          // Issue #300: Research Preview 登録枠が満了している場合、サーバーは
          // 409 + { error: 'capacity_reached' } を返す（OAuth 新規ユーザーのみ）
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          if (res.status === 409 && body.error === 'capacity_reached') {
            setError(tErr('capacity_reached'));
            return;
          }
          setError(t('error_auth_failed'));
          return;
        }

        const data = (await res.json()) as {
          user: { id: string; email: string };
          session: { accessToken: string; refreshToken: string };
        };

        setTokens(data.session.accessToken, data.session.refreshToken);
        posthog.identify(data.user.id, { email: data.user.email });
        router.push('/entries/new');
        return;
      }

      // Supabase implicit flow: tokens in URL hash fragment.
      // Issue #307: Supabase JS のデフォルトが implicit flow のため、Google SSO 新規ユーザーは
      // この分岐を通る。`/oauth/finalize` を叩いて profile 作成と登録枠チェックを行う
      // （PKCE 側の `/oauth/callback` と同じ責務）。これを呼ばないと profile が永久に作られず、
      // onboarding モーダルも出ない。
      const hash = window.location.hash;
      if (hash) {
        const params = parseHashParams(hash);
        const accessToken = params.access_token;
        const refreshToken = params.refresh_token;

        if (accessToken && refreshToken) {
          setTokens(accessToken, refreshToken);

          const localeParam = searchParams.get('locale');
          const locale = localeParam === 'ja' || localeParam === 'en' ? localeParam : undefined;
          const client = createApiClient(accessToken);
          const finalizeRes = await client.fetch('/api/v1/auth/oauth/finalize', {
            method: 'POST',
            body: JSON.stringify({ locale }),
          });

          if (!finalizeRes.ok) {
            const body = (await finalizeRes.json().catch(() => ({}))) as { error?: string };
            if (finalizeRes.status === 409 && body.error === 'capacity_reached') {
              setError(tErr('capacity_reached'));
              return;
            }
            setError(t('error_auth_failed'));
            return;
          }

          const data = (await finalizeRes.json()) as { user: { id: string; email: string } };
          posthog.identify(data.user.id, { email: data.user.email });

          router.push('/entries/new');
          return;
        }
      }

      setError(t('error_no_code'));
    }

    handleCallback();
  }, [searchParams, router, t, tErr]);

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
