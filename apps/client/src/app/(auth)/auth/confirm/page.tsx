'use client';

import { useTranslations } from 'next-intl';
import { Suspense } from 'react';
import { useEmailConfirm } from '@/features/shared/auth/hooks/use-email-confirm';

/**
 * Supabase メールテンプレートからのリンクを受けて確定処理を行う画面。
 * 通信・セッション確定・遷移は features/shared/auth の useEmailConfirm が担い、
 * ここはエラーコードを i18n で描くだけ（Issue #490）。
 */
function ConfirmHandler() {
  const t = useTranslations('auth.confirm');
  const { error } = useEmailConfirm();

  if (error) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
          {error === 'invalid_link' ? t('error_invalid_link') : t('error_failed')}
        </p>
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
