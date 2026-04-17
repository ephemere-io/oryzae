'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { PageFooter } from '@/components/ui/page-footer';
import { Sidebar } from '@/features/auth/components/sidebar';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { SIDEBAR_WIDTH, SidebarProvider } from '@/lib/sidebar-context';
import { ThemeProvider } from '@/lib/theme-context';
import { UnreadProvider } from '@/lib/unread-context';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { auth, api, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !auth) {
      router.push('/login');
    }
  }, [loading, auth, router]);

  if (loading) return null;

  if (!auth) return null;

  return (
    <ThemeProvider>
      <SidebarProvider>
        <UnreadProvider api={api} authLoading={loading}>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <main
              className="flex flex-1 flex-col overflow-hidden"
              style={
                {
                  marginLeft: SIDEBAR_WIDTH,
                  '--sidebar-width': `${SIDEBAR_WIDTH}px`,
                } as React.CSSProperties
              }
            >
              <div className="relative flex-1 overflow-auto">{children}</div>
              <PageFooter />
            </main>
          </div>
        </UnreadProvider>
      </SidebarProvider>
    </ThemeProvider>
  );
}
