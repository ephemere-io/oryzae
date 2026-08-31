'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { DesktopOnlyOverlay } from '@/components/desktop-only-overlay';
import { PageFooter } from '@/components/ui/page-footer';
import { OnboardingFlow } from '@/features/onboarding/components/onboarding-flow';
import { Sidebar } from '@/features/pc/navigation/components/sidebar';
import { useUnreadLetters } from '@/features/shared/fermentation/hooks/use-unread-letters';
import { useOnboarding } from '@/features/shared/onboarding/hooks/use-onboarding';
import type { OnboardingResult } from '@/features/shared/onboarding/types';
import { SpBottomNav } from '@/features/sp/navigation/components/sp-bottom-nav';
import { useAuth } from '@/lib/auth-context';
import { SidebarProvider, useSidebarVisibility } from '@/lib/sidebar-context';
import { ThemeProvider } from '@/lib/theme-context';
import { UnreadProvider } from '@/lib/unread-context';
import { useDevice } from '@/lib/use-device';
import { RouteLoading } from './_loading/route-loading';

/**
 * PC のシェル。サイドバーの幅は畳む／開く／掴んで引く で変わるので、
 * `<main>` の左余白と `--sidebar-width` はその値に追従させる。
 * Provider が配る値を読むために、Provider の**中**の部品として切ってある。
 */
function PcShell({ children }: { children: React.ReactNode }) {
  const { width, restored } = useSidebarVisibility();
  // CSS カスタムプロパティは React.CSSProperties に含まれないので、
  // `--*` を許す形で型を広げて宣言する（キャストは使わない）。
  const mainStyle: React.CSSProperties & Record<`--${string}`, string> = {
    marginLeft: width,
    '--sidebar-width': `${width}px`,
  };
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main
        className={`flex flex-1 flex-col overflow-hidden ${
          restored ? 'transition-[margin-left] duration-300' : ''
        }`}
        style={mainStyle}
      >
        <div className="relative flex-1 overflow-auto">{children}</div>
        <PageFooter />
      </main>
      {/* PC で coarse-pointer かつ狭幅のケースを保護（SP は専用体験があるので出さない） */}
      <DesktopOnlyOverlay />
    </div>
  );
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { auth, api, loading } = useAuth();
  const { shouldShow, complete } = useOnboarding(api);
  // 未読の算出は features/shared の hook が持ち、context は配るだけ（lib はドメインを知らない）。
  // 全画面で 1 つの状態を共有するため、取得もここで 1 回だけ行う（#363 の N+1 解消を維持）。
  const unread = useUnreadLetters(api, loading);
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

  // Issue #362/#363: 認証完了を待たず children を描画。mount 前は SSR でも出せるロード表示を
  // 描画し、FCP を「空白」にしない（体感ロードを短縮）。
  //
  // ここで出すものは **行き先の画面に合わせる**。ハードリロードでは Suspense が挟まらず
  // loading.tsx が出番を持たないため、最初に見えるのはこの1枚だけになる。
  // 保護ルート全体で1枚を使い回していた頃は、/jar や /board を直接開いても一覧の枠が出て、
  // 読み込み完了時に画面が丸ごと入れ替わっていた。
  const content = mounted ? children : <RouteLoading />;

  return (
    <ThemeProvider>
      <SidebarProvider>
        <UnreadProvider value={unread}>
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
            <PcShell>{content}</PcShell>
          ) : null}
          {device !== null && shouldShow && (
            <OnboardingFlow onComplete={handleOnboardingComplete} />
          )}
        </UnreadProvider>
      </SidebarProvider>
    </ThemeProvider>
  );
}
