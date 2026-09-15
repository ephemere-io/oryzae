'use client';

import { useTranslations } from 'next-intl';
import { Suspense } from 'react';
import { AuthStatus } from '@/features/shared/auth/components/auth-status';
import { useLeaveThroughEntrance } from '@/features/shared/auth/entrance/context';
import { useEmailConfirm } from '@/features/shared/auth/hooks/use-email-confirm';

/**
 * Supabase メールテンプレートからのリンクを受けて確定処理を行う画面。
 * 通信・セッション確定・遷移は features/shared/auth の useEmailConfirm が担い、
 * ここはエラーコードを i18n で描くだけ（Issue #490）。
 *
 * 書斎へ向かう確定なら扉を開けて入る。パスワード再設定のように扉の手前へ戻る
 * 行き先なら、扉は開けずにそのまま移る（`staysAtEntrance`）。
 */
function ConfirmHandler() {
  const t = useTranslations('auth.confirm');
  const leave = useLeaveThroughEntrance();
  const { error } = useEmailConfirm(leave);

  if (error) {
    return (
      <AuthStatus
        state="error"
        message={error === 'invalid_link' ? t('error_invalid_link') : t('error_failed')}
        backLabel={t('back_to_login')}
      />
    );
  }

  return <AuthStatus state="pending" message={t('processing')} />;
}

function ConfirmFallback() {
  const t = useTranslations('auth.confirm');
  return <AuthStatus state="pending" message={t('processing')} />;
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<ConfirmFallback />}>
      <ConfirmHandler />
    </Suspense>
  );
}
