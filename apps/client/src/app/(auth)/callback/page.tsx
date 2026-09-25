'use client';

import { useTranslations } from 'next-intl';
import { Suspense } from 'react';
import { AuthStatus } from '@/features/shared/auth/components/auth-status';
import { useLeaveThroughEntrance } from '@/features/shared/auth/entrance/context';
import { useOauthCallback } from '@/features/shared/auth/hooks/use-oauth-callback';

/**
 * OAuth のコールバック画面。通信・セッション確定・遷移は
 * features/shared/auth の useOauthCallback が担い、ここはエラーコードを i18n で
 * 描くだけ（Issue #490）。
 *
 * 確定したら扉を開けて書斎へ入り、溶け切ってから読み込み直す。
 */
function CallbackHandler() {
  const t = useTranslations('auth.callback');
  const tErr = useTranslations('auth.error');
  const leave = useLeaveThroughEntrance();
  const { error } = useOauthCallback(leave);

  if (error) {
    return (
      <AuthStatus
        state="error"
        message={
          error === 'capacity_reached'
            ? tErr('capacity_reached')
            : error === 'no_code'
              ? t('error_no_code')
              : t('error_auth_failed')
        }
        backLabel={t('back_to_login')}
      />
    );
  }

  return <AuthStatus state="pending" message={t('authenticating')} />;
}

function CallbackFallback() {
  const t = useTranslations('auth.callback');
  return <AuthStatus state="pending" message={t('loading')} />;
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<CallbackFallback />}>
      <CallbackHandler />
    </Suspense>
  );
}
