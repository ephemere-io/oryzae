'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import { PageFooter } from '@/components/ui/page-footer';
import { Sidebar } from '@/features/auth/components/sidebar';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { OnboardingFlow } from '@/features/onboarding/components/onboarding-flow';
import { useOnboarding } from '@/features/onboarding/hooks/use-onboarding';
import type { OnboardingResult } from '@/features/onboarding/types';
import { SIDEBAR_WIDTH, SidebarProvider } from '@/lib/sidebar-context';
import { ThemeProvider } from '@/lib/theme-context';
import { UnreadProvider } from '@/lib/unread-context';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { auth, api, loading } = useAuth();
  const { shouldShow, complete } = useOnboarding(api);
  const router = useRouter();

  const handleOnboardingComplete = useCallback(
    async (result: OnboardingResult) => {
      const { questionId } = await complete(result);
      // Pass questionId so it pre-links AND triggers a refetch even when
      // /entries/new is already mounted (post-login redirect lands here first).
      const target = questionId ? `/entries/new?questionId=${questionId}` : '/entries/new';
      router.push(target);
    },
    [complete, router],
  );

  useEffect(() => {
    if (!loading && !auth) {
      router.push('/login');
    }
  }, [loading, auth, router]);

  // Not authenticated and not loading → redirect in progress
  if (!loading && !auth) return null;

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
              <div className="relative flex-1 overflow-auto">{loading ? null : children}</div>
              <PageFooter />
            </main>
            {shouldShow && <OnboardingFlow onComplete={handleOnboardingComplete} />}
          </div>
        </UnreadProvider>
      </SidebarProvider>
    </ThemeProvider>
  );
}
