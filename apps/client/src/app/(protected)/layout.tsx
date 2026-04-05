'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Sidebar } from '@/features/auth/components/sidebar';
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
        <p className="text-sm text-[var(--date-color)]">読み込み中...</p>
      </div>
    );
  }

  if (!auth) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-4xl px-4 py-6">{children}</div>
      </main>
    </div>
  );
}
