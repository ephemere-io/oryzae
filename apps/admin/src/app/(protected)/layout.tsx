'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AdminSidebar } from '@/features/auth/components/admin-sidebar';
import { useAdminAuth } from '@/features/auth/hooks/use-admin-auth';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { auth, loading } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !auth) {
      router.push('/login');
    }
  }, [loading, auth, router]);

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  if (!auth) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar />
      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-[1400px]">{children}</div>
      </main>
    </div>
  );
}
