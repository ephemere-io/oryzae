'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminSidebar } from '@/features/auth/components/admin-sidebar';
import { useAdminAuth } from '@/features/auth/hooks/use-admin-auth';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { auth, loading } = useAdminAuth();
  const router = useRouter();

  // Issue #362: 認証検証(dashboard/stats + me の2連続フェッチ)の完了を待って
  // 全画面を「読み込み中…」にすると体感が遅い。children はクライアントマウント直後に
  // 描画し（各ページ/フックがトークン直読で即フェッチ）、検証完了は待たない。
  // SSR では描画しないことでハイドレーション不一致も防ぐ。未認証は下の useEffect が /login へ。
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loading && !auth) {
      router.push('/login');
    }
  }, [loading, auth, router]);

  if (!auth && !loading) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar />
      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-[1400px]">{mounted ? children : null}</div>
      </main>
    </div>
  );
}
