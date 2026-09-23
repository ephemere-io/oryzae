'use client';

// verify-exempt: three.js の dynamic import・pathname・画面全体の溶暗を束ねる画面級の合成。
// 紙に載る中身（各認証フォーム・AuthStatus）は個別に検証されている。

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LocaleSwitcher } from '@/components/ui/locale-switcher';
import { emptyStudyState } from '@/features/shared/study/empty-state';
import type { StudyLayout } from '@/features/shared/study/layout';
import { keepLiveScene } from '@/features/shared/study/scene/live';
import type { StudySceneHandle } from '@/features/shared/study/scene/scene';
import { entranceSprig, microSeasonIndex } from '@/features/shared/study/scene/sprig';
import { traceMark } from '@/lib/trace';
import { EntranceContext } from '../entrance/context';
import { type EnterPlan, enterPlan } from '../entrance/door';
import { PAPER_FONT, PAPER_SHADOW, PAPER_STYLE } from '../entrance/paper';
import { entersStudy, isPassage, staysAtEntrance } from '../entrance/passage';
import type { EntranceControls } from '../types';

/**
 * three.js は初期バンドルに載せない。紙（フォーム）は SSR でそのまま出るので、扉が
 * 届くまでの間もログインはできる。扉は届いたら地から浮かび上がる。
 */
const StudyCanvas = dynamic(
  () =>
    import('@/features/shared/study/components/study-canvas').then((module) => module.StudyCanvas),
  { ssr: false, loading: () => null },
);

export interface AuthEntranceProps {
  /**
   * 書斎の構図。**認証画面も書斎と同じシーンを見ている** — 扉は書斎の入口で、ログインすると
   * カメラが外から中へ 1 本で動く（`docs/oryzae-study/70-entrance.md`）。
   * 端末との対応づけは `features/pc/auth` と `features/sp/auth` が持つ。
   */
  layout: StudyLayout;
  /**
   * 紙（フォーム）の置き方。
   *
   * - `side`: 扉の右に紙を 1 枚立てる（PC）
   * - `sheet`: 下から紙を敷く。扉は上の窓に残る（SP）
   */
  panel: 'side' | 'sheet';
  children: ReactNode;
}

/** 扉が地から浮かび上がるまで（ms）。書斎の入りの溶暗と同じ長さ。 */
const APPEAR_MS = 800;

/**
 * 入り始めてから、シーンを次の画面へ預けるまで（ms）。
 *
 * **カメラがまだ動き出していないあいだに渡す**（歩き出しは 480ms）。ページの入れ替えは
 * React の仕事で、実測で 140ms ほど主スレッドを塞ぐ。止まっているあいだなら見えないが、
 * 歩いている最中に重ねると、その分だけ道のりが飛ぶ（PR #624 の「カクッとする」）。
 *
 * 紙が退き終わる（360ms）のを待ってからにする。まだ紙が見えているうちに外すと、そこで
 * 紙だけが消える。
 */
const HANDOFF_MS = 380;

/** 認証画面の色。扉の前は明るい地で固定（暗い色を選んでいる人も、扉の外はここ）。 */
const ENTRANCE_THEME = 'light';

/** 何もしない（認証画面では 3D の物を押して移動しない）。 */
function noop(): void {}

/**
 * 通り道の画面（`/callback` `/auth/confirm`）で扉が現れるまで（ms）。
 *
 * ここは**別のドメインから戻ってきた直後**（Google の同意画面など）。文書が入れ替わるので
 * 扉は作り直しになるが、利用者にとっては「さっき手を掛けた扉の続き」。ゆっくり浮かび
 * 上がらせると、そこが 1 つの画面切り替えとして読める（PR #624 の実機レビュー
 * 「ここでまた画面切り替えが発生しています」）。**待たせずに、もう目の前にある**ようにする。
 */
const PASSAGE_APPEAR_MS = 220;

/** 入るとき、紙が先に退くまで（ms）。扉が開き始める前に視界を空ける。 */
const PAPER_RETREAT_MS = 360;

/** SP の紙の中身が入れ替わったとき、外枠の高さを寄せる長さ（ms）。 */
const PAPER_RESIZE_MS = 380;

/**
 * 認証画面の地。**書斎の手前の扉**を 3D で置き、その前に紙（フォーム）を 1 枚置く。
 *
 * - 待っている間: 扉はわずかに開いていて、隙間から奥の書斎の気配が覗く
 * - 送信中: 扉が少し大きく開く（`EntranceControls.setWaiting`）。失敗すれば閉じ直す
 * - 入れたら: 紙が退き、扉を押し開けて奥へ歩き、**最後の 1 枚を書斎へ渡す**（`enter`）。
 *   書斎はその絵の上にカメラが入ってきて止まるので、ログインの前後が 1 つの廊下の続きになる
 *
 * レイアウトに置くので、ログイン ↔ 登録 ↔ パスワード再設定を行き来しても扉は作り直さない。
 */
export function AuthEntrance({ layout, panel, children }: AuthEntranceProps) {
  const pathname = usePathname();
  const passage = isPassage(pathname);

  const handleRef = useRef<StudySceneHandle | null>(null);
  /**
   * 扉が届く前に頼まれた「待つ」。
   *
   * three.js は遅れて届くので、通り道の画面は扉より先に `setWaiting(true)` を呼ぶ。
   * 捨てると、認証している間じゅう扉が閉じたままになる。届いた時点で渡す。
   */
  const waitingRef = useRef(passage);
  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState<EnterPlan | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  /**
   * SP で扉を見せる窓（紙の上の余白）。**高さを測って扉の構図に渡す。**
   *
   * 紙の高さは中身（入り方だけ / 入力欄まで / 認証中）で変わり、画面の高さも端末で違う。
   * 構図を画面全体に対して決めていた頃は、紙が伸びると扉の下半分が紙に潜り、
   * 背の低い端末では扉ごと切れていた（実機レビュー）。
   */
  const windowRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);

  const handleSceneHandle = useCallback((handle: StudySceneHandle | null) => {
    handleRef.current = handle;
    handle?.setDoorWaiting(waitingRef.current);
    if (frameRef.current !== null) handle?.setFrame(frameRef.current);
  }, []);
  const handleReady = useCallback(() => setReady(true), []);

  /** ログインする前の書斎（中身は空）。認証が通ったら書斎の側が差し替える。 */
  const emptyState = useMemo(() => emptyStudyState(new Date().toISOString().slice(0, 10)), []);
  /**
   * 一輪挿しに挿さる枝。いまの候（七十二候）で決まる（`study/scene/sprig.ts`）。
   * 開いている間は変えない — 画面を見ている最中に枝が変わる意味は無い。
   */
  const sprig = useMemo(() => entranceSprig(microSeasonIndex(new Date())), []);

  const sheet = panel === 'sheet';

  /**
   * SP の紙の中身の高さ。**紙の外枠はこの値へ transition で寄せる。**
   *
   * 中身は入り方だけ → 入力欄まで → 認証中、と入れ替わる。高さを中身に任せると紙が
   * 一瞬で伸び縮みし、下端の余白ごと跳ねて見えた（実機レビュー）。外枠の高さだけを
   * 動かし、下の余白と位置は据え置く。`height: auto` は transition できないので、中身を測って渡す。
   * 最初の 1 回（null → 値）は `auto` からなので動かない。
   */
  const paperRef = useRef<HTMLDivElement>(null);
  const [paperHeight, setPaperHeight] = useState<number | null>(null);

  useEffect(() => {
    const element = paperRef.current;
    if (!sheet || element === null) return;
    const observer = new ResizeObserver(() => setPaperHeight(element.offsetHeight));
    observer.observe(element);
    setPaperHeight(element.offsetHeight);
    return () => observer.disconnect();
  }, [sheet]);

  useEffect(() => {
    const element = windowRef.current;
    if (!sheet || element === null) return;
    const report = () => {
      frameRef.current = element.offsetHeight;
      handleRef.current?.setFrame(element.offsetHeight);
    };
    const observer = new ResizeObserver(report);
    observer.observe(element);
    report();
    return () => observer.disconnect();
  }, [sheet]);

  const controls = useMemo<EntranceControls>(
    () => ({
      compact: sheet,
      setWaiting: (waiting) => {
        waitingRef.current = waiting;
        handleRef.current?.setDoorWaiting(waiting);
      },
      /**
       * 扉をくぐって行き先へ。
       *
       * **シーンは 1 つ、カメラは 1 本。** 扉の前から書斎のホームまで、同じカメラが動いていく。
       * 途中でページが入れ替わるので、シーンごと次の画面へ預ける（`scene/live.ts`）。
       * 以前は扉だけの別シーンを持ち、入るときに 2 つをクロスフェードしていた — それが
       * 「一回切り替わる」正体だった（`docs/oryzae-study/70-entrance.md`）。
       */
      enter: async (destination) => {
        // 扉の手前の画面へ戻るだけなら、扉は動かさない（`staysAtEntrance` の注釈）。
        if (staysAtEntrance(destination)) return;
        const handle = handleRef.current;
        /**
         * 扉の前から行き先まで、カメラが 1 本で続くか。
         *
         * 続くのは**書斎へ向かうときだけ**。扉が無い（WebGL 非対応・まだ届いていない）
         * ときと、動きを減らす設定では、そもそも動かさずに溶かす。
         */
        const continuous = handle !== null && !reducedMotion && entersStudy(destination);
        const plan = enterPlan(reducedMotion || handle === null, continuous);
        setLeaving(plan);
        if (handle === null) {
          await wait(plan.totalMs);
          return;
        }
        traceMark('扉を開き始める');
        // 紙が退くので、窓は画面全体に戻る。
        handle.setFrame(Number.POSITIVE_INFINITY);
        // カメラが扉をくぐってホームへ向かい始める。**着くのを待たない。**
        void handle.enterStudy();
        if (!continuous) {
          // 行き先が書斎ではない。扉が開くところまでを見せて、溶暗で繋ぐ。
          await wait(plan.totalMs);
          return;
        }
        await wait(HANDOFF_MS);
        // ここから canvas は React のツリーの外（`keepLiveScene`）。どの画面が
        // mount / unmount しても、見えている動きは同じ 1 本のまま。書斎の canvas が
        // mount したところで入れ物と受け口だけ差し替わる（`StudySceneHandle.adopt`）。
        keepLiveScene({ canvas: handle.canvas, handle, layout, theme: ENTRANCE_THEME });
        traceMark('シーンを次の画面へ預けた');
        await afterPaint();
      },
    }),
    [layout, reducedMotion, sheet],
  );

  return (
    <EntranceContext.Provider value={controls}>
      <div
        /**
         * 高さの下限は **`svh` と `dvh` の小さい方**＝いま見えている高さを超えない。
         *
         * `svh` だけでは足りない。実機の Dia（iPhone 15 Pro）で測ると
         * `100svh = 793` / `100dvh = 717` / `innerHeight = 717` で、**`svh` の方が
         * 実際の表示領域より 76px 大きい**。その分だけ紙が下にはみ出し、ツールバーの裏に
         * 隠れていた（iOS の一部ブラウザは `svh` を画面の高さのまま返す）。
         *
         * `dvh` だけにもしない。Safari では読み進めるとツールバーが畳まれて `dvh` が伸び、
         * 紙の位置が動いてしまう。小さい方を取れば、**どちらのブラウザでも見えている中に収まり、
         * かつ動かない**。
         *
         * `<body>`（`h-full` = ツールバーの裏まで含む）いっぱいに伸ばさないこと（`flex-1` を
         * 付けない）も引き続き要る。伸ばすと下端の紙がその底に着いてしまう。
         */
        className="relative flex min-h-[min(100svh,100dvh)] flex-col"
        style={{
          opacity: leaving === null ? 1 : 0,
          transition:
            leaving === null
              ? undefined
              : `opacity ${leaving.fadeMs}ms ease-in ${leaving.fadeStartMs}ms`,
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0"
          style={{
            opacity: ready ? 1 : 0,
            transition: `opacity ${passage ? PASSAGE_APPEAR_MS : APPEAR_MS}ms ease-out`,
          }}
        >
          <StudyCanvas
            state={emptyState}
            layout={layout}
            theme={ENTRANCE_THEME}
            atEntrance
            sprig={sprig}
            onHandle={handleSceneHandle}
            onReady={handleReady}
            onNavigate={noop}
          />
        </div>

        {/* 言語は右上の隅に 1 つ。通り道の画面では出さない（`isPassage` の注釈）。 */}
        {passage ? null : (
          <div
            className="fixed right-4 z-20"
            style={{
              top: 'max(16px, env(safe-area-inset-top))',
              opacity: leaving === null ? 1 : 0,
              transition: `opacity ${PAPER_RETREAT_MS}ms ease-out`,
            }}
          >
            <LocaleSwitcher />
          </div>
        )}

        {sheet ? (
          <>
            {/* 扉を見せる窓。紙はこの下にあり、キーボードと一緒にスクロールする。
                窓は余りを引き受けて伸びる — 中身の短い紙（認証中など）は画面の下に座り、
                空白のまま下まで垂れない。 */}
            <div
              ref={windowRef}
              aria-hidden="true"
              className="flex-1"
              style={{ minHeight: SHEET_WINDOW_MIN }}
            />
            {/* 紙は画面の下端に貼り付けず、左右と下に余白を取って浮かせる。退くときは
                余白ごと画面の下へ滑り出る。 */}
            <div
              className="relative z-10 px-3"
              style={{
                paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
                transform: leaving === null ? 'translateY(0)' : 'translateY(calc(100% + 24px))',
                transition: `transform ${PAPER_RETREAT_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`,
              }}
            >
              <main
                className="mx-auto w-full max-w-[440px] overflow-hidden rounded-[28px]"
                style={{
                  ...PAPER_FONT,
                  // **擦りガラスにしない。** 紙は扉の足元に重なるので、透かすと縁に扉の線が
                  // ぼやけて滲み、汚れに見える（実機で確認）。紙の色で塗り、縁と影で浮かせる。
                  background: '#fdfbf7',
                  border: PAPER_STYLE.border,
                  boxShadow: PAPER_SHADOW,
                  height: paperHeight ?? undefined,
                  transition:
                    paperHeight === null || reducedMotion
                      ? undefined
                      : `height ${PAPER_RESIZE_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`,
                }}
              >
                <div ref={paperRef} className="px-6 py-6">
                  {children}
                </div>
              </main>
            </div>
          </>
        ) : (
          // 紙は**常に右端**。画面幅で中央と右を切り替えていたころ、Brave では切り替えが効かず
          // 紙が中央に来て扉に被った（PR #624 のレビュー）。PC の構図は扉が左・紙が右で一組なので、
          // 幅で置き場を変える理由がそもそも無い。狭い窓でも紙は 400px + 余白で収まる。
          <main className="relative z-10 flex flex-1 items-center justify-end px-6 py-16 pr-[max(24px,8vw)]">
            <div
              className="w-full max-w-[400px] rounded-[20px] px-9 py-10"
              style={{
                ...PAPER_STYLE,
                ...PAPER_FONT,
                boxShadow: PAPER_SHADOW,
                opacity: leaving === null ? 1 : 0,
                transform: leaving === null ? 'translateY(0)' : 'translateY(12px)',
                transition: `opacity ${PAPER_RETREAT_MS}ms ease-out, transform ${PAPER_RETREAT_MS}ms ease-out`,
              }}
            >
              {children}
            </div>
          </main>
        )}
      </div>
    </EntranceContext.Provider>
  );
}

/**
 * SP で扉を見せる窓の最低の高さ。
 *
 * 窓の高さは紙の残りで決まり（`flex-1`）、扉はその窓に収まるよう構図を合わせる。
 * 入力欄の多い紙（登録）でも扉の気配が消えないよう、最低限だけ残す。
 * 高さの単位は根と同じ「小さい方」で揃える（`svh` だけだと実際より大きく見積もる端末がある）。
 */
const SHEET_WINDOW_MIN = 'clamp(72px, min(12svh, 12dvh), 140px)';

/**
 * 次の描画が終わるまで待つ。
 *
 * rAF のコールバックは**その回の描画の前**に走るので、2 回待って初めて「1 回描かれた」
 * ことになる。
 */
function afterPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
