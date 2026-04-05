'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Header } from '@/features/auth/components/header';
import { useAuth } from '@/features/auth/hooks/use-auth';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { auth, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !auth) {
      router.push('/login');
    }
  }, [loading, auth, router]);

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <p className="text-sm text-zinc-500">読み込み中...</p>
      </div>
    );
  }

  if (!auth) return null;

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
