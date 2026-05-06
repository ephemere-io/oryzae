'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { GoogleLoginButton } from '@/features/auth/components/google-login-button';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { translateAuthError } from '@/features/auth/utils/error-messages';

function isSupportedLocale(value: string): value is 'ja' | 'en' {
  return value === 'ja' || value === 'en';
}

export function SignupForm() {
  const t = useTranslations('auth.signup');
  const tErr = useTranslations('auth.error');
  const localeRaw = useLocale();
  const locale = isSupportedLocale(localeRaw) ? localeRaw : 'ja';
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const router = useRouter();
  const { signup, auth } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== passwordConfirm) {
      setError(t('error_password_mismatch'));
      return;
    }

    setLoading(true);

    const err = await signup(nickname, email, password, locale);
    if (err) {
      setError(translateAuthError(err, tErr));
      setLoading(false);
      return;
    }

    // If session was returned (email confirmation disabled), go to entries
    if (auth) {
      router.push('/entries');
      return;
    }

    // Otherwise show email confirmation message
    setEmailSent(true);
    setLoading(false);
  }

  if (emailSent) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <h1 className="text-2xl font-bold">Oryzae</h1>
        <p className="text-sm text-zinc-500">{t('email_sent_subheading')}</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <span className="font-medium">{email}</span> {t('email_sent_body')}
        </p>
        <Link
          href="/login"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {t('back_to_login')}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-center">Oryzae</h1>
      <p className="text-sm text-center text-zinc-500">{t('subheading')}</p>

      <GoogleLoginButton />

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
        <span className="text-xs text-zinc-400">{t('divider_or')}</span>
        <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t('nickname_label')}</span>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          required
          minLength={2}
          maxLength={30}
          pattern="^[a-zA-Z0-9_-]+$"
          placeholder="my_nickname"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <span className="text-xs text-zinc-400">{t('nickname_help')}</span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t('email_label')}</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t('password_label')}</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t('confirm_label')}</span>
        <input
          type="password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          required
          minLength={6}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {loading ? t('submit_loading') : t('submit')}
      </button>

      <p className="text-sm text-center text-zinc-500">
        {t('have_account_prefix')}{' '}
        <Link href="/login" className="font-medium text-zinc-900 dark:text-zinc-100">
          {t('login_link')}
        </Link>
      </p>
    </form>
  );
}
