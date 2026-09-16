'use client';

import { verifyAttrs } from '@oryzae/verify';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense, useEffect, useState } from 'react';
import {
  ERROR_CLASS,
  HEADING_CLASS,
  INPUT_CLASS,
  LABEL_CLASS,
  LEAD_CLASS,
  PAPER_STACK_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  SERIF_FONT,
} from '@/features/shared/auth/entrance/paper';
import { translateAuthError } from '@/features/shared/auth/error-messages';
import { useAuthActions } from '@/features/shared/auth/hooks/use-auth-actions';
import { getAccessToken } from '@/lib/auth';

function ResetPasswordHandler() {
  const t = useTranslations('auth.reset_password');
  const tErr = useTranslations('auth.error');
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { updatePassword } = useAuthActions();
  // /auth/confirm で verifyOtp 完了 → セッションが localStorage に保存済みの想定。
  // SSR では localStorage を参照できないので useEffect で取得して状態に反映する。
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tokenChecked, setTokenChecked] = useState(false);

  useEffect(() => {
    setAccessToken(getAccessToken());
    setTokenChecked(true);
  }, []);

  if (!tokenChecked) {
    return <p className={LEAD_CLASS}>{t('loading')}</p>;
  }

  if (!accessToken) {
    return (
      <div
        className={PAPER_STACK_CLASS}
        {...verifyAttrs({ unit: 'ResetPasswordForm', state: 'invalid', hasError: false })}
      >
        <h1 className={HEADING_CLASS} style={SERIF_FONT}>
          {t('heading')}
        </h1>
        <p className={ERROR_CLASS}>{t('invalid_link')}</p>
        <Link href="/forgot-password" className={SECONDARY_BUTTON_CLASS}>
          {t('back_link')}
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('error_mismatch'));
      return;
    }
    // トークン無しではフォーム自体が描画されない（下の invalid_link 分岐）。
    // クロージャからは絞り込めないのでここでも確認する。
    if (!accessToken) return;

    setLoading(true);

    const result = await updatePassword(accessToken, password);

    if (!result.ok) {
      setError(translateAuthError(result.error, tErr));
      setLoading(false);
      return;
    }

    router.push('/login');
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={PAPER_STACK_CLASS}
      {...verifyAttrs({ unit: 'ResetPasswordForm', state: 'form', hasError: Boolean(error) })}
    >
      <header className="mb-2 flex flex-col gap-3">
        <h1 className={HEADING_CLASS} style={SERIF_FONT}>
          {t('heading')}
        </h1>
        <p className={LEAD_CLASS}>{t('subheading')}</p>
      </header>

      {error && (
        <p role="alert" className={ERROR_CLASS}>
          {error}
        </p>
      )}

      <label className="flex flex-col gap-2">
        <span className={LABEL_CLASS}>{t('password_label')}</span>
        <input
          type="password"
          aria-label={t('password_label')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
          className={INPUT_CLASS}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className={LABEL_CLASS}>{t('confirm_label')}</span>
        <input
          type="password"
          aria-label={t('confirm_label')}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
          className={INPUT_CLASS}
        />
      </label>

      <button type="submit" disabled={loading} className={`mt-1 ${PRIMARY_BUTTON_CLASS}`}>
        {loading ? t('submit_loading') : t('submit')}
      </button>
    </form>
  );
}

function ResetPasswordFallback() {
  const t = useTranslations('auth.reset_password');
  return <p className={LEAD_CLASS}>{t('loading')}</p>;
}

export function ResetPasswordForm() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordHandler />
    </Suspense>
  );
}
