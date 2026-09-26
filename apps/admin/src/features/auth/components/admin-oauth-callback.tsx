'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAdminGoogleLogin } from '../hooks/use-admin-google-login';

/** Google から戻ってきたところ。確定できたらダッシュボードへ、だめなら理由を出す。 */
export function AdminOAuthCallback() {
  const { completeGoogleLogin } = useAdminGoogleLogin();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // 開発時の StrictMode で effect が 2 回走っても、確定は 1 回だけにする。
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    completeGoogleLogin(window.location).then((err) => {
      if (err) setError(err);
      else router.replace('/dashboard');
    });
  }, [completeGoogleLogin, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      {error ? (
        <div className="max-w-[360px] space-y-3 text-center">
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
            {error}
          </p>
          <Link href="/login" className="text-[13px] text-muted-foreground underline">
            ログイン画面に戻る
          </Link>
        </div>
      ) : (
        <p className="text-[13px] text-muted-foreground">ログインしています…</p>
      )}
    </div>
  );
}
