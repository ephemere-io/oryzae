'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { DesktopOnlyOverlay } from '@/components/desktop-only-overlay';
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

  // Issue #362: 保護下の children はクライアント専用に描画する。
  // SSR では描画しない（mounted=false）ことで、エディタ等の時刻依存レンダリングが
  // サーバー↔クライアントで食い違うハイドレーション不一致(React #418)を防ぐ。
  // それでも auth/me の完了は待たない（マウント直後＝~1s で描画）ため、
  // 旧来の「認証完了まで全画面空白(~3s)」は解消したまま。
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

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
              {/* Issue #362: 認証チェック完了を待たずマウント直後に children を描画
                  （各ページがスケルトンを即出せる）。ただし SSR では描画せず
                  ハイドレーション不一致を避ける。未認証時は上の useEffect が /login へ。 */}
              <div className="relative flex-1 overflow-auto">{mounted ? children : null}</div>
              <PageFooter />
            </main>
            {shouldShow && <OnboardingFlow onComplete={handleOnboardingComplete} />}
            {/* スマホ専用画面が用意できるまでの暫定処置 (Issue #299) — 保護下のページはスマホ非対応 */}
            <DesktopOnlyOverlay />
          </div>
        </UnreadProvider>
      </SidebarProvider>
    </ThemeProvider>
  );
}
