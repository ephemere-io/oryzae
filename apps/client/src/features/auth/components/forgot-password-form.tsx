'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { translateAuthError } from '@/features/auth/utils/error-messages';
import { createApiClient } from '@/lib/api';

export function ForgotPasswordForm() {
  const t = useTranslations('auth.forgot_password');
  const tErr = useTranslations('auth.error');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const redirectTo = `${window.location.origin}/reset-password`;
    const client = createApiClient();
    const res = await client.fetch('/api/v1/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, redirectTo }),
    });

    if (!res.ok) {
      const data = (await res.json()) as { error: string };
      setError(translateAuthError(data.error, tErr));
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <h1 className="text-2xl font-bold">{t('sent_heading')}</h1>
        <p className="text-sm text-zinc-500">
          {email} {t('sent_body')}
        </p>
        <Link href="/login" className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {t('back_to_login')}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-center">{t('heading')}</h1>
      <p className="text-sm text-center text-zinc-500">{t('subheading')}</p>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}

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

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {loading ? t('submit_loading') : t('submit')}
      </button>

      <p className="text-sm text-center text-zinc-500">
        <Link href="/login" className="font-medium text-zinc-900 dark:text-zinc-100">
          {t('back_to_login_2')}
        </Link>
      </p>
    </form>
  );
}
