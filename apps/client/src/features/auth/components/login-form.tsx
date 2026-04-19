'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { GoogleLoginButton } from '@/features/auth/components/google-login-button';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { translateAuthError } from '@/features/auth/utils/error-messages';

export function LoginForm() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const err = await login(identifier, password);
    if (err) {
      setError(translateAuthError(err));
      setLoading(false);
      return;
    }

    router.push('/entries');
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-center">Oryzae</h1>
      <p className="text-sm text-center text-zinc-500">ログインして続ける</p>

      <GoogleLoginButton />

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
        <span className="text-xs text-zinc-400">または</span>
        <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">ニックネームまたはメールアドレス</span>
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
        <span className="text-sm font-medium">パスワード</span>
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
          パスワードを忘れた方
        </Link>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {loading ? 'ログイン中...' : 'ログイン'}
      </button>

      <p className="text-sm text-center text-zinc-500">
        アカウントをお持ちでない方は{' '}
        <Link href="/signup" className="font-medium text-zinc-900 dark:text-zinc-100">
          サインアップ
        </Link>
      </p>
    </form>
  );
}
