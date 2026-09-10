'use client';

import { verifyAttrs } from '@oryzae/verify';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { GoogleLoginButton } from '@/features/shared/auth/components/google-login-button';
import { translateAuthError } from '@/features/shared/auth/error-messages';
import { useHomeHref } from '@/features/shared/study/hooks/use-home-href';
import { useAuth } from '@/lib/auth-context';

export function LoginForm() {
  const t = useTranslations('auth.login');
  const tErr = useTranslations('auth.error');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();
  // 行き先は HomeGate と同じものを使う。ここで /entries/new を直書きすると、
  // ?study=on を付けても「ログインした先が書斎にならない」。
  const { href: home, resolved } = useHomeHref();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const err = await login(identifier, password);
    if (err) {
      setError(translateAuthError(err, tErr));
      setLoading(false);
      return;
    }

    // 手動切替はマウント時の effect で読むので、送信までにはまず解決している。
    // 万一まだなら `/` へ送る（HomeGate が同じ規則で振り分ける）。
    router.push(resolved ? home : '/');
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
      {...verifyAttrs({
        unit: 'LoginForm',
        filled: identifier.trim().length > 0 && password.length > 0,
        loading,
        hasError: error.length > 0,
      })}
    >
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
        <span className="text-sm font-medium">{t('identifier_label')}</span>
        <input
          type="text"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
          placeholder="nickname or email@example.com"
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

      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          {t('forgot_link')}
        </Link>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {loading ? t('submit_loading') : t('submit')}
      </button>

      <p className="text-sm text-center text-zinc-500">
        {t('no_account_prefix')}{' '}
        <Link href="/signup" className="font-medium text-zinc-900 dark:text-zinc-100">
          {t('signup_link')}
        </Link>
      </p>
    </form>
  );
}
