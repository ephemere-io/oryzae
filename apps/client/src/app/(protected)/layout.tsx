'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Sidebar } from '@/features/auth/components/sidebar';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { COLLAPSED_WIDTH, EXPANDED_WIDTH, useSidebar } from '@/lib/sidebar-context';

function SidebarTrigger() {
  const { toggle } = useSidebar();
  return (
    <button
      type="button"
      onClick={toggle}
      className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--date-color)] transition-all hover:bg-[var(--toolbar-hover)] hover:text-[var(--fg)]"
      title="サイドバーを切替 (⌘B)"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 3v18" />
      </svg>
    </button>
  );
}

function ProtectedContent({ children }: { children: React.ReactNode }) {
  const { expanded } = useSidebar();
  const sidebarWidth = expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH;

  return (
    <main
      className="flex flex-1 flex-col overflow-auto transition-[margin-left] duration-200 ease-linear"
      style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}
    >
      {/* Top bar with sidebar trigger */}
      <div className="flex items-center px-4 py-2">
        <SidebarTrigger />
      </div>
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 pb-6">{children}</div>
    </main>
  );
}

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
      <ProtectedContent>{children}</ProtectedContent>
    </div>
  );
}
