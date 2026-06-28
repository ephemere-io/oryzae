'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { DesktopOnlyOverlay } from '@/components/desktop-only-overlay';
import { SpBottomNav } from '@/components/sp-bottom-nav';
import { PageFooter } from '@/components/ui/page-footer';
import { ShellSkeleton } from '@/components/ui/shell-skeleton';
import { Sidebar } from '@/features/auth/components/sidebar';
import { OnboardingFlow } from '@/features/onboarding/components/onboarding-flow';
import { useOnboarding } from '@/features/onboarding/hooks/use-onboarding';
import type { OnboardingResult } from '@/features/onboarding/types';
import { useAuth } from '@/lib/auth-context';
import { SIDEBAR_WIDTH, SidebarProvider } from '@/lib/sidebar-context';
import { ThemeProvider } from '@/lib/theme-context';
import { UnreadProvider } from '@/lib/unread-context';
import { useDevice } from '@/lib/use-device';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { auth, api, loading } = useAuth();
  const { shouldShow, complete } = useOnboarding(api);
  const device = useDevice();
  const router = useRouter();

  // Issue #362/#363: 保護下の children はクライアント専用に描画する（mounted ゲート）。
  // エディタ等の時刻依存・認証依存レンダリングが SSR↔client で食い違う不一致(React #418)
  // を防ぐため。一方 device はサーバー(x-device)で確定済みなので **シェルとスケルトンは
  // SSR で即描画**できる（children だけ mount 後）。これで FCP が空白でなくなる。
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

  // Issue #362/#363: 認証完了を待たず children を描画。mount 前は SSR でも出せる
  // 汎用スケルトンを描画し、FCP を「空白」でなく「枠」にする（体感ロードを短縮）。
  const content = mounted ? children : <ShellSkeleton />;

  return (
    <ThemeProvider>
      <SidebarProvider>
        <UnreadProvider api={api} authLoading={loading}>
          {/* device はサーバー(x-device)で確定済み＝first render から端末別シェルを SSR 描画。
              null フォールバックは Provider 外などの保険（通常は到達しない）。 */}
          {device === 'sp' ? (
            // SP シェル: フルスクリーン・サイドバーなし・端末ブロックなし（URL は不変）。
            // 高さは 100dvh（dynamic viewport）。100vh だとモバイルブラウザのツールバー
            // 出現時にボトムナビが画面外/ツールバー裏へ押し出されるため。
            <div className="flex h-[100dvh] flex-col overflow-hidden">
              <main className="relative flex-1 overflow-auto">{content}</main>
              <SpBottomNav />
            </div>
          ) : device === 'pc' ? (
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
                <div className="relative flex-1 overflow-auto">{content}</div>
                <PageFooter />
              </main>
              {/* PC で coarse-pointer かつ狭幅のケースを保護（SP は専用体験があるので出さない） */}
              <DesktopOnlyOverlay />
            </div>
          ) : null}
          {device !== null && shouldShow && (
            <OnboardingFlow onComplete={handleOnboardingComplete} />
          )}
        </UnreadProvider>
      </SidebarProvider>
    </ThemeProvider>
  );
}
