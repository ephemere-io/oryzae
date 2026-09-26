'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { DesktopOnlyOverlay } from '@/components/desktop-only-overlay';
import { PageFooter } from '@/components/ui/page-footer';
import { HelpSidebar } from '@/features/pc/help/components/help-sidebar';
import { Sidebar } from '@/features/pc/navigation/components/sidebar';
import { useRootHashHandoff } from '@/features/shared/auth/hooks/use-root-hash-handoff';
import { useUnreadLetters } from '@/features/shared/fermentation/hooks/use-unread-letters';
import { HelpToggle } from '@/features/shared/help/components/help-toggle';
import { HelpWelcomeGate } from '@/features/shared/help/components/help-welcome-gate';
import { HelpProvider } from '@/features/shared/help/help-context';
import { BackToStudy, STUDY_EXIT_BAND } from '@/features/shared/study/components/back-to-study';
import { PullBackToStudy } from '@/features/shared/study/components/pull-back-to-study';
import { QuestionsLink } from '@/features/shared/study/components/questions-link';
import { StudyIcon } from '@/features/shared/study/components/study-icon';
import { useStudyHome } from '@/features/shared/study/hooks/use-study-home-flag';
import { SpHelpSheet } from '@/features/sp/help/components/sp-help-sheet';
import { SpBottomNav } from '@/features/sp/navigation/components/sp-bottom-nav';
import { useAuth } from '@/lib/auth-context';
import { BackLinkProvider } from '@/lib/back-link-context';
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
}: {
  children: React.ReactNode;
  /** 書斎が唯一のグローバルナビか。真なら左サイドバーを描かない。 */
  studyHome: boolean;
  /** いま書斎ホームそのものか。真ならフッターも外す。 */
  onStudy: boolean;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* 書斎が有効な間は左サイドバーを描かない。行き先は 3D の物そのものが持ち、
          サブ画面からの戻り道は各画面の左上の「‹ 書斎」（BackLink）が担う。 */}
      {!studyHome && <Sidebar />}
      {/* 左余白は CSS 変数（--sidebar-width）が配る。サイドバー本体・本文・エディタが
          同じ1本を見るので、掴んで引いても3者が同じフレームで動く。 */}
      <main
        className="sidebar-inset flex flex-1 flex-col overflow-hidden"
        // **サイドバーを描かない間は、その変数もここで 0 にする。**
        // 変数は SidebarProvider が :root へ書くので、描かなくても 80px のまま残る。
        // margin だけ外して変数を残すと、これを読んでいるボードのツールバーと
        // エディタの左端だけが 80px ずれる。
        style={shellStyle(studyHome)}
      >
        <div className="relative flex-1 overflow-auto">{children}</div>
        {/* 書斎は全画面の一枚絵。下にフッターが挟まると机の手前が切れる。 */}
        {!onStudy && <PageFooter />}
      </main>
      {/* ヘルプの面。開いている間だけ右に立ち、本文はそのぶん詰まる（被らない）。 */}
      <HelpSidebar />
      {/* PC で coarse-pointer かつ狭幅のケースを保護（SP は専用体験があるので出さない） */}
      <DesktopOnlyOverlay />
    </div>
  );
}

/**
 * `<main>` が配る CSS 変数。
 *
 * `--sidebar-width`: サイドバーを描かない間は 0（`SidebarProvider` が :root に
 * 書いた 80px が残ると、これを読んでいるボードのツールバーとエディタの左端だけずれる）。
 */
function shellStyle(studyHome: boolean): MainStyle {
  return studyHome ? { '--sidebar-width': '0px' } : {};
}

/**
 * SP のシェルが配る変数。**SP だけはタブの高さぶん画面を下げる** — SP のヘッダーは
 * 題を中央に置くので、タブの真下に題が来てしまう。
 */
function spShellStyle(exitBand: boolean): MainStyle {
  return { '--study-exit-band': exitBand ? `${STUDY_EXIT_BAND}px` : '0px' };
}

/** 書斎ホームそのもののパス（ルート）。ここだけサイドバーを外す。 */
const STUDY_PATH = '/';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { auth, api, loading } = useAuth();
  // 未読の算出は features/shared の hook が持ち、context は配るだけ（lib はドメインを知らない）。
  // 全画面で 1 つの状態を共有するため、取得もここで 1 回だけ行う（#363 の N+1 解消を維持）。
  const unread = useUnreadLetters(api, loading);
  const device = useDevice();
  const router = useRouter();
  const pathname = usePathname();
  // ルート（/）に届いたメールリンクの hash を、ログインへ送る判断より先に読む。
  // 以前は / の HomeGate が持っていた。/ が書斎（保護ルート）になったので、ここが引き継ぐ。
  const rootHashHandoff = useRootHashHandoff(pathname === STUDY_PATH);

  // 書斎ホームのときだけ PC シェルの構成が変わる（サイドバーとフッターを外す）。
  // フラグ off の間はこの分岐が常に false になり、シェルは従来どおり。
  // 解決前は false 扱いでよい（シェルの見た目が 1 フレーム遅れて変わるだけで、
  // 後戻りできない判断はしていない）。env で on にしている環境では初回から true。
  const { enabled: studyHome } = useStudyHome();
  const onStudy = studyHome && pathname === STUDY_PATH;
  // 書斎が有効な間のサブ画面には、書斎へ戻る道を出す。
  const showBackToStudy = studyHome && pathname !== STUDY_PATH;
  const tStudy = useTranslations('study');
  /**
   * PC の戻る道の行き先。**置くのは各画面**（ヘッダーの先頭の `BackLink`）で、ここは
   * 行き先を配るだけ。null の間（書斎そのもの・書斎が無効）はどの画面にも出ない。
   */
  const backLink = useMemo(
    () =>
      showBackToStudy
        ? {
            href: STUDY_PATH,
            label: tStudy('title'),
            ariaLabel: tStudy('back_to_study'),
            icon: <StudyIcon />,
          }
        : null,
    [showBackToStudy, tStudy],
  );
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

  useEffect(() => {
    // hash の引き継ぎ中（読み込み直し・確認画面への回送）はログインへ送らない。
    // 送ると、期限切れリンクの理由を見せる前にログイン画面へ流してしまう。
    if (!loading && !auth && !rootHashHandoff.current) {
      router.push('/login');
    }
  }, [loading, auth, router, rootHashHandoff]);

  // Not authenticated and not loading → redirect in progress
  if (!loading && !auth) return null;

  // Issue #362/#363: 認証完了を待たず children を描画。mount 前は SSR でも出せるロード表示を
  // 描画し、FCP を「空白」にしない（体感ロードを短縮）。
  //
  // ここで出すものは **行き先の画面に合わせる**。ハードリロードでは Suspense が挟まらず
  // loading.tsx が出番を持たないため、最初に見えるのはこの1枚だけになる。
  // 保護ルート全体で1枚を使い回していた頃は、/jar や /board を直接開いても一覧の枠が出て、
  // 読み込み完了時に画面が丸ごと入れ替わっていた。
  const content = (
    // 戻る道の行き先は画面の中身にだけ配る（置くのは各画面のヘッダー）。
    <BackLinkProvider value={backLink}>{mounted ? children : <RouteLoading />}</BackLinkProvider>
  );

  return (
    <ThemeProvider>
      <SidebarProvider>
        <UnreadProvider value={unread}>
          {/* ヘルプモード。初めての人には自動で開く（旧オンボーディングの置き換え）。
              シェルの中の面（PC は右、SP は下）と、書斎の的・左の列の「使い方」・`?` が
              この 1 つの状態を共有する。 */}
          <HelpProvider api={api}>
            {/* device はサーバー(x-device)で確定済み＝first render から端末別シェルを SSR 描画。
              null フォールバックは Provider 外などの保険（通常は到達しない）。 */}
            {device === 'sp' ? (
              // SP シェル: フルスクリーン・サイドバーなし・端末ブロックなし（URL は不変）。
              // 高さは 100dvh（dynamic viewport）。100vh だとモバイルブラウザのツールバー
              // 出現時にボトムナビが画面外/ツールバー裏へ押し出されるため。
              <div
                className="flex h-[100dvh] flex-col overflow-hidden"
                style={spShellStyle(showBackToStudy)}
              >
                {/* padding ではなく margin で下げる。padding だと箱の位置が動かず、
                  `absolute inset-0` で敷いている画面がタブの下へ潜る（絶対配置が
                  基準にするのは padding box の外側の縁）。 */}
                <main
                  className="relative flex-1 overflow-auto"
                  style={{ marginTop: 'var(--study-exit-band, 0px)' }}
                >
                  {content}
                </main>
                {/* 書斎が有効な間はボトムナビを描かない。PC のサイドバーと同じ扱いで、
                  書斎そのものが唯一のグローバルナビゲーションになる。
                  **書斎ホームだけでなく jar / board / entry でも外す**（行き先の画面にだけ
                  旧ナビが残ると、戻り道が左上のマークとボトムナビで二重になる）。
                  フラグ off の間は従来どおり全画面に出る。 */}
                {!studyHome && <SpBottomNav />}
                <SpHelpSheet />
              </div>
            ) : device === 'pc' ? (
              <PcShell studyHome={studyHome} onStudy={onStudy}>
                {content}
              </PcShell>
            ) : null}
            {/* SP はまだ上端の中央から垂れるタブ。PC は各画面の左上の BackLink が担う。 */}
            {device === 'sp' && showBackToStudy && <BackToStudy />}
            {/* 引き切ったキャンバスからさらに引くと、部屋が滲み出て書斎へ戻る。
              板と瓶（キャンバスを持つ画面）で効く。重ねるのがここなのは、画面そのものに
              触れずに済ませるため。 */}
            {device !== null && showBackToStudy && <PullBackToStudy />}
            {showQuestionsLink && <QuestionsLink />}
            {/* 画面の右上の「?」。ヘルプモードが有効な間だけ。PC は全画面、SP は書斎だけ
              （サブ画面の SP は上端に題があり、右上に席が無い。アカウントの設定から開ける）。 */}
            {(device === 'pc' || (device === 'sp' && pathname === STUDY_PATH)) && <HelpToggle />}
            {/* 初めての人の「ようこそ」。面以外を沈め、案内の在処と「始めてみよう」だけ。 */}
            {device !== null && <HelpWelcomeGate guide={device === 'sp' ? 'below' : 'right'} />}
          </HelpProvider>
        </UnreadProvider>
      </SidebarProvider>
    </ThemeProvider>
  );
}
