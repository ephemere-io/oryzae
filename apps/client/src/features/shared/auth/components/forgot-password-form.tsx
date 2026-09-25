'use client';

import { verifyAttrs } from '@oryzae/verify';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  ERROR_CLASS,
  FOOT_CLASS,
  HEADING_CLASS,
  INLINE_LINK_CLASS,
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

export function ForgotPasswordForm() {
  const t = useTranslations('auth.forgot_password');
  const tErr = useTranslations('auth.error');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const { requestPasswordReset } = useAuthActions();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const redirectTo = `${window.location.origin}/reset-password`;
    const result = await requestPasswordReset(email, redirectTo);

    if (!result.ok) {
      setError(translateAuthError(result.error, tErr));
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className={PAPER_STACK_CLASS}>
        <h1 className={HEADING_CLASS} style={SERIF_FONT}>
          {t('sent_heading')}
        </h1>
        <p className="text-[14px] leading-relaxed text-[#5c4f3f]">
          <span className="font-medium text-[#2d2d2d]">{email}</span> {t('sent_body')}
        </p>
        <Link href="/login" className={SECONDARY_BUTTON_CLASS}>
          {t('back_to_login')}
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={PAPER_STACK_CLASS}
      {...verifyAttrs({ unit: 'ForgotPasswordForm', hasEmail: Boolean(email) })}
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
        <span className={LABEL_CLASS}>{t('email_label')}</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className={INPUT_CLASS}
        />
      </label>

      <button type="submit" disabled={loading} className={`mt-1 ${PRIMARY_BUTTON_CLASS}`}>
        {loading ? t('submit_loading') : t('submit')}
      </button>

      <p className={`text-center ${FOOT_CLASS}`}>
        <Link href="/login" className={INLINE_LINK_CLASS}>
          {t('back_to_login_2')}
        </Link>
      </p>
    </form>
  );
}
