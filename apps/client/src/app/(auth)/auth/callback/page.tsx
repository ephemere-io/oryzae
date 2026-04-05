'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { setTokens } from '@/lib/auth';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');

    if (accessToken && refreshToken) {
      setTokens(accessToken, refreshToken);
      router.replace('/entries');
    } else {
      router.replace('/login?error=auth_failed');
    }
  }, [searchParams, router]);

  return (
    <div className="flex items-center justify-center">
      <p className="text-sm text-zinc-500">認証中...</p>
    </div>
  );
}
