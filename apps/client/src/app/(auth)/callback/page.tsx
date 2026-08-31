'use client';

import { useTranslations } from 'next-intl';
import { Suspense } from 'react';
import { useOauthCallback } from '@/features/shared/auth/hooks/use-oauth-callback';

/**
 * OAuth のコールバック画面。通信・セッション確定・遷移は
 * features/shared/auth の useOauthCallback が担い、ここはエラーコードを i18n で
 * 描くだけ（Issue #490）。
 */
function CallbackHandler() {
  const t = useTranslations('auth.callback');
  const tErr = useTranslations('auth.error');
  const { error } = useOauthCallback();

  if (error) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
          {error === 'capacity_reached'
            ? tErr('capacity_reached')
            : error === 'no_code'
              ? t('error_no_code')
              : t('error_auth_failed')}
        </p>
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
