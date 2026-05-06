'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense, useEffect, useState } from 'react';
import { translateAuthError } from '@/features/auth/utils/error-messages';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

function ResetPasswordHandler() {
  const t = useTranslations('auth.reset_password');
  const tErr = useTranslations('auth.error');
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // /auth/confirm で verifyOtp 完了 → セッションが localStorage に保存済みの想定。
  // SSR では localStorage を参照できないので useEffect で取得して状態に反映する。
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tokenChecked, setTokenChecked] = useState(false);

  useEffect(() => {
    setAccessToken(getAccessToken());
    setTokenChecked(true);
  }, []);

  if (!tokenChecked) {
    return <p className="text-sm text-center text-zinc-500">{t('loading')}</p>;
  }

  if (!accessToken) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{t('invalid_link')}</p>
        <Link
          href="/forgot-password"
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
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

    setLoading(true);

    const client = createApiClient();
    const res = await client.fetch('/api/v1/auth/update-password', {
      method: 'POST',
      body: JSON.stringify({ accessToken, password }),
    });

    if (!res.ok) {
      const data = (await res.json()) as { error: string };
      setError(translateAuthError(data.error, tErr));
      setLoading(false);
      return;
    }

    router.push('/login');
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-center">{t('heading')}</h1>
      <p className="text-sm text-center text-zinc-500">{t('subheading')}</p>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}

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
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
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
    </form>
  );
}

function ResetPasswordFallback() {
  const t = useTranslations('auth.reset_password');
  return <p className="text-sm text-center text-zinc-500">{t('loading')}</p>;
}

export function ResetPasswordForm() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordHandler />
    </Suspense>
  );
}
