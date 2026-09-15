'use client';

// verify-exempt: three.js の dynamic import・pathname・画面全体の溶暗を束ねる画面級の合成。
// 紙に載る中身（各認証フォーム・AuthStatus）は個別に検証されている。

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LocaleSwitcher } from '@/components/ui/locale-switcher';
import { CONTROL_FONT } from '@/components/ui/surface';
import { EntranceContext } from '../entrance/context';
import { type EnterPlan, enterPlan } from '../entrance/door';
import type { EntranceLayout } from '../entrance/layout';
import { PAPER_SHADOW, PAPER_STYLE } from '../entrance/paper';
import { isPassage } from '../entrance/passage';
import type { EntranceSceneHandle } from '../entrance/scene';
import type { EntranceControls } from '../types';

/**
 * three.js は初期バンドルに載せない。紙（フォーム）は SSR でそのまま出るので、扉が
 * 届くまでの間もログインはできる。扉は届いたら地から浮かび上がる。
 */
const EntranceCanvas = dynamic(
  () => import('./entrance-canvas').then((module) => module.EntranceCanvas),
  { ssr: false, loading: () => null },
);

export interface AuthEntranceProps {
  /** 構図。端末との対応づけは `features/pc/auth` と `features/sp/auth` が持つ。 */
  layout: EntranceLayout;
  children: ReactNode;
}

/** 扉が地から浮かび上がるまで（ms）。書斎の入りの溶暗と同じ長さ。 */
const APPEAR_MS = 800;

/** 入るとき、紙が先に退くまで（ms）。扉が開き始める前に視界を空ける。 */
const PAPER_RETREAT_MS = 360;

/**
 * 認証画面の地。**書斎の手前の扉**を 3D で置き、その前に紙（フォーム）を 1 枚置く。
 *
 * - 待っている間: 扉はわずかに開いていて、隙間から奥の書斎の気配が覗く
 * - 送信中: 扉が少し大きく開く（`EntranceControls.setWaiting`）。失敗すれば閉じ直す
 * - 入れたら: 紙が退き、扉を押し開けて奥へ歩き、地の色に溶ける（`enter`）。
 *   書斎は同じ地の色から現れるので、ログインの前後が 1 つの廊下の続きになる
 *
 * レイアウトに置くので、ログイン ↔ 登録 ↔ パスワード再設定を行き来しても扉は作り直さない。
 */
export function AuthEntrance({ layout, children }: AuthEntranceProps) {
  const pathname = usePathname();
  const passage = isPassage(pathname);

  const handleRef = useRef<EntranceSceneHandle | null>(null);
  /**
   * 扉が届く前に頼まれた「待つ」。
   *
   * three.js は遅れて届くので、通り道の画面は扉より先に `setWaiting(true)` を呼ぶ。
   * 捨てると、認証している間じゅう扉が閉じたままになる。届いた時点で渡す。
   */
  const waitingRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState<EnterPlan | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  const handleSceneHandle = useCallback((handle: EntranceSceneHandle | null) => {
    handleRef.current = handle;
    handle?.setWaiting(waitingRef.current);
  }, []);
  const handleReady = useCallback(() => setReady(true), []);

  const controls = useMemo<EntranceControls>(
    () => ({
      setWaiting: (waiting) => {
        waitingRef.current = waiting;
        handleRef.current?.setWaiting(waiting);
      },
      enter: () => {
        const handle = handleRef.current;
        // 扉が無い（WebGL 非対応・まだ届いていない）ときは溶かすだけにする。
        const plan = enterPlan(reducedMotion || handle === null);
        setLeaving(plan);
        return handle === null ? wait(plan.totalMs) : handle.enter(plan);
      },
    }),
    [reducedMotion],
  );

  const sheet = layout.panel === 'sheet';

  return (
    <EntranceContext.Provider value={controls}>
      <div
        className="relative flex min-h-[100svh] flex-1 flex-col"
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
          style={{ opacity: ready ? 1 : 0, transition: `opacity ${APPEAR_MS}ms ease-out` }}
        >
          <EntranceCanvas
            layout={layout}
            reducedMotion={reducedMotion}
            onHandle={handleSceneHandle}
            onReady={handleReady}
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
            {/* 扉を見せる窓。紙はこの下から始まり、キーボードと一緒にスクロールする。
                窓は余りを引き受けて伸びる — 中身の短い紙（認証中など）は画面の下端に座り、
                空白のまま下まで垂れない。 */}
            <div aria-hidden="true" className="flex-1" style={{ minHeight: SHEET_WINDOW }} />
            <main
              className="relative z-10 rounded-t-[24px] px-6 pt-8"
              style={{
                ...CONTROL_FONT,
                // **擦りガラスにしない。** 紙は扉の足元に重なるので、透かすと上端に扉の線が
                // ぼやけて滲み、汚れに見える（実機で確認）。紙の色で塗り、上端の縁と影だけで立てる。
                background: '#fdfbf7',
                borderTop: PAPER_STYLE.border,
                boxShadow: '0 -18px 40px -28px rgba(74, 70, 50, 0.28)',
                paddingBottom: 'max(32px, env(safe-area-inset-bottom))',
                transform: leaving === null ? 'translateY(0)' : 'translateY(105%)',
                transition: `transform ${PAPER_RETREAT_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`,
              }}
            >
              <div className="mx-auto w-full max-w-[420px]">{children}</div>
            </main>
          </>
        ) : (
          <main className="relative z-10 flex flex-1 items-center justify-center px-6 py-16 md:justify-end md:pr-[max(40px,8vw)]">
            <div
              className="w-full max-w-[400px] rounded-[20px] px-9 py-10"
              style={{
                ...PAPER_STYLE,
                ...CONTROL_FONT,
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
 * SP で扉を見せる窓の高さ。
 *
 * 画面の 4 割。ただし背の低い画面（横向き・小さな端末）では紙を優先して縮め、
 * 背の高い画面でも扉ばかりが大きくならないよう上限を置く。
 */
const SHEET_WINDOW = 'clamp(200px, 40svh, 380px)';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
