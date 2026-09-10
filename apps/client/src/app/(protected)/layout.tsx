'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { DesktopOnlyOverlay } from '@/components/desktop-only-overlay';
import { PageFooter } from '@/components/ui/page-footer';
import { Sidebar } from '@/features/pc/navigation/components/sidebar';
import { useUnreadLetters } from '@/features/shared/fermentation/hooks/use-unread-letters';
import { OnboardingFlow } from '@/features/shared/onboarding/components/onboarding-flow';
import { useOnboarding } from '@/features/shared/onboarding/hooks/use-onboarding';
import type { OnboardingResult } from '@/features/shared/onboarding/types';
import {
  BACK_MARK_SEAT_X,
  BACK_MARK_SEAT_Y,
  BackToStudy,
} from '@/features/shared/study/components/back-to-study';
import { QuestionsLink } from '@/features/shared/study/components/questions-link';
import { useStudyHome } from '@/features/shared/study/hooks/use-study-home-flag';
import { SpBottomNav } from '@/features/sp/navigation/components/sp-bottom-nav';
import { useAuth } from '@/lib/auth-context';
import { SidebarProvider } from '@/lib/sidebar-context';
import { ThemeProvider } from '@/lib/theme-context';
import { UnreadProvider } from '@/lib/unread-context';
import { useDevice } from '@/lib/use-device';
import { RouteLoading } from './_loading/route-loading';

// CSS カスタムプロパティは React.CSSProperties に含まれないので、
// `--*` を許す形で型を広げて宣言する（キャストは使わない）。
type MainStyle = React.CSSProperties & Record<`--${string}`, string>;

/**
 * PC のシェル。幅の追従は CSS 変数に任せるので、ここは形だけを持つ。
 *
 * 書斎が有効な間だけ構成が変わる（サイドバーを描かない／書斎ホームではフッターも外す）。
 * フラグ off の間はどの分岐も false になり、従来どおりのシェルになる。
 */
function PcShell({
  children,
  studyHome,
  onStudy,
  backStyle,
}: {
  children: React.ReactNode;
  /** 書斎が唯一のグローバルナビか。真なら左サイドバーを描かない。 */
  studyHome: boolean;
  /** いま書斎ホームそのものか。真ならフッターも外す。 */
  onStudy: boolean;
  /** 「書斎へ戻る」マークの席（`--study-back-*`）。出ていない間は undefined。 */
  backStyle?: MainStyle;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* 書斎が有効な間は左サイドバーを描かない。行き先は 3D の物そのものが持ち、
          サブ画面からの戻り道は左上のマークが担う。 */}
      {!studyHome && <Sidebar />}
      {/* 左余白は CSS 変数（--sidebar-width）が配る。サイドバー本体・本文・エディタが
          同じ1本を見るので、掴んで引いても3者が同じフレームで動く。 */}
      <main
        className="sidebar-inset flex flex-1 flex-col overflow-hidden"
        // **サイドバーを描かない間は、その変数もここで 0 にする。**
        // 変数は SidebarProvider が :root へ書くので、描かなくても 80px のまま残る。
        // margin だけ外して変数を残すと、これを読んでいるボードのツールバーと
        // エディタの左端だけが 80px ずれる。
        style={studyHome ? { ...backStyle, '--sidebar-width': '0px' } : backStyle}
      >
        <div className="relative flex-1 overflow-auto">{children}</div>
        {/* 書斎は全画面の一枚絵。下にフッターが挟まると机の手前が切れる。 */}
        {!onStudy && <PageFooter />}
      </main>
      {/* PC で coarse-pointer かつ狭幅のケースを保護（SP は専用体験があるので出さない） */}
      <DesktopOnlyOverlay />
    </div>
  );
}

/**
 * 左上のマーク（BackToStudy）を避けるための座標。
 *
 * マークはどの画面の上にも浮くので、画面側の左上に操作があるとその上に重なる
 * （エディタの「新規」ボタン、ボードの上部バー、SP の日付がそうだった）。
 * **画面側が席を空けるための変数**で、マークが出ていない間は 0px。
 *
 * 値はマークの外形から導く（`BACK_MARK_SEAT_X` / `_Y`）。手で決めた定数にしていた
 * ころ、マークを縮めたときに席だけ別に詰めてしまい、席がマークより狭くなって
 * 重なりが残った。数字を 2 か所で持つと必ずずれる。
 *
 * **中身は「絶対座標」。** 読む側は自前の余白に足すのではなく `max()` で比べる。
 */
const STUDY_BACK_INSET = `${BACK_MARK_SEAT_X}px`;
const STUDY_BACK_DROP = `${BACK_MARK_SEAT_Y}px`;

const studyBackStyle: MainStyle = {
  '--study-back-inset': STUDY_BACK_INSET,
  '--study-back-drop': STUDY_BACK_DROP,
};

/** 書斎ホームそのもののパス。ここだけサイドバーを外す。 */
const STUDY_PATH = '/study';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { auth, api, loading } = useAuth();
  const { shouldShow, complete } = useOnboarding(api);
  // 未読の算出は features/shared の hook が持ち、context は配るだけ（lib はドメインを知らない）。
  // 全画面で 1 つの状態を共有するため、取得もここで 1 回だけ行う（#363 の N+1 解消を維持）。
  const unread = useUnreadLetters(api, loading);
  const device = useDevice();
  const router = useRouter();
  const pathname = usePathname();

  // 書斎ホームのときだけ PC シェルの構成が変わる（サイドバーとフッターを外す）。
  // フラグ off の間はこの分岐が常に false になり、シェルは従来どおり。
  // 解決前は false 扱いでよい（シェルの見た目が 1 フレーム遅れて変わるだけで、
  // 後戻りできない判断はしていない）。env で on にしている環境では初回から true。
  const { enabled: studyHome } = useStudyHome();
  const onStudy = studyHome && pathname === STUDY_PATH;
  // 書斎が有効な間、サブ画面の左上にはマークが「書斎へ戻る」として浮く。
  const showBackToStudy = studyHome && pathname !== STUDY_PATH;
  /**
   * 「問いの変遷」への導線を出すか。
   *
   * サイドバーを外したことで `/questions` はどこからも行けなくなった。問いの追加と
   * 編集は瓶の中でできるが、いつ・どう変わってきたかはあの画面にしかない。
   *
   * **PC だけ**。SP の瓶には「問いを整える」が下端にあり、そこから同じ画面へ入れる。
   * 右上にもう 1 つ置くと、同じ行き先の入口が 2 つ並ぶことになる。
   */
  const showQuestionsLink = studyHome && device === 'pc' && pathname === '/jar';

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
            <div
              className="flex h-[100dvh] flex-col overflow-hidden"
              style={showBackToStudy ? studyBackStyle : undefined}
            >
              <main className="relative flex-1 overflow-auto">{content}</main>
              {/* 書斎が有効な間はボトムナビを描かない。PC のサイドバーと同じ扱いで、
                  書斎そのものが唯一のグローバルナビゲーションになる。
                  **書斎ホームだけでなく jar / board / entry でも外す**（行き先の画面にだけ
                  旧ナビが残ると、戻り道が左上のマークとボトムナビで二重になる）。
                  フラグ off の間は従来どおり全画面に出る。 */}
              {!studyHome && <SpBottomNav />}
            </div>
          ) : device === 'pc' ? (
            <PcShell
              studyHome={studyHome}
              onStudy={onStudy}
              backStyle={showBackToStudy ? studyBackStyle : undefined}
            >
              {content}
            </PcShell>
          ) : null}
          {device !== null && showBackToStudy && <BackToStudy />}
          {showQuestionsLink && <QuestionsLink />}
          {device !== null && shouldShow && (
            <OnboardingFlow onComplete={handleOnboardingComplete} />
          )}
        </UnreadProvider>
      </SidebarProvider>
    </ThemeProvider>
  );
}
