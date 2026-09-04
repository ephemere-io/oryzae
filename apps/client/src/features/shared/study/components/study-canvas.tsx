'use client';

// verify-exempt: WebGL(three.js) の renderer と rAF を持つため孤立描画できない。
// シーンの規則は scene/*.ts の純関数テストで、実機の見え方はブラウザ確認で担保する。

import { useEffect, useRef } from 'react';
import type { StudyLayout } from '../layout';
import { staysInStudy } from '../navigation';
import type { StudyTheme } from '../scene/materials';
import {
  type HoverInfo,
  initScene,
  type LabelPositions,
  type StudySceneHandle,
} from '../scene/scene';
import type { StudyState, StudyTarget } from '../types';

export interface StudyCanvasProps {
  state: StudyState;
  layout: StudyLayout;
  theme: StudyTheme;
  /**
   * カメラが着いてから呼ばれる。ここで `router.push` する。
   *
   * **着いてから URL を変える**のが要点。クロスフェードの間に遷移することで、
   * 開く途中で画面が切り替わるのを防ぐ。
   */
  onNavigate: (target: StudyTarget) => void;
  /** 書斎の中で完結する対象（過去月・棚）。一覧オーバーレイを開く。 */
  onOpenOverlay?: (target: StudyTarget) => void;
  onHoverChange?: (hovered: HoverInfo | null) => void;
  onLabelPositions?: (positions: LabelPositions) => void;
}

/** `prefers-reduced-motion` を読む。SSR とテストでは false に倒す。 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function StudyCanvas({
  state,
  layout,
  theme,
  onNavigate,
  onOpenOverlay,
  onHoverChange,
  onLabelPositions,
}: StudyCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<StudySceneHandle | null>(null);

  // コールバックは ref 経由で読む。props が変わるたびにシーンを作り直すと、
  // 親が再描画しただけで canvas が組み直される。
  const callbacks = useRef({ onNavigate, onOpenOverlay, onHoverChange, onLabelPositions });
  callbacks.current = { onNavigate, onOpenOverlay, onHoverChange, onLabelPositions };

  // state はレンダーのたびに新しい参照になりうる（取得が落ち着くまで数回変わる）。
  // 最新を ref で渡し、シーンの作り直しは effect の外で行う。
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // WebGL が無い環境ではシーンを作らない（呼び出し側が静止フォールバックを出す）。
    let handle: StudySceneHandle;
    try {
      handle = initScene({
        container,
        state: stateRef.current,
        layout,
        theme,
        reducedMotion: prefersReducedMotion(),
        onHoverChange: (hovered) => callbacks.current.onHoverChange?.(hovered),
        onLabelPositions: (positions) => callbacks.current.onLabelPositions?.(positions),
        onPick: (target) => {
          // 遷移の中身は**カメラが動く前**に決まっている（targetHref / overlayScope が
          // 対象そのものから導く）。着いてから初めて画面を切り替える。
          handle.goTo(target).then(() => {
            if (staysInStudy(target)) {
              callbacks.current.onOpenOverlay?.(target);
              // オーバーレイは書斎の中。閉じたときに戻れるようホーム位置へ返す。
              handle.returnHome();
              return;
            }
            callbacks.current.onNavigate(target);
          });
        },
      });
    } catch {
      // WebGL の初期化に失敗した。書斎は出ないが、画面全体は壊さない。
      return;
    }

    handleRef.current = handle;

    return () => {
      // dispose を怠ると再マウントで canvas が積み上がり、古い層のイベントだけが生き残る。
      handle.dispose();
      handleRef.current = null;
    };
    // **renderer は layout / theme が変わったときだけ作り直す。**
    // ここに state を入れていたせいで、取得が落ち着くまでの数回の更新でそのつど
    // renderer を捨てて作り直しており、WebGL のコンテキストを食い潰していた
    // （`Too many active WebGL contexts`）。あわせて遷移中に作り直されると
    // カメラがホームへ巻き戻り、押したのに何も起きない状態になっていた。
  }, [layout, theme]);

  // 状態の反映は作り直しではなく差し替えで行う（遷移中は scene 側が無視する）。
  useEffect(() => {
    handleRef.current?.setState(state);
  }, [state]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      // canvas 自体がポインタを受ける。3D の物が的で、ラベルは上に重なる。
      onPointerMove={(event) => {
        const handle = handleRef.current;
        if (!handle) return;
        const rect = event.currentTarget.getBoundingClientRect();
        handle.setPointer(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -(((event.clientY - rect.top) / rect.height) * 2 - 1),
        );
      }}
      onPointerLeave={() => handleRef.current?.clearPointer()}
      onPointerDown={(event) => {
        // タッチでは pointermove が click より先に来ないことがある。押した位置を
        // 先に入れてから拾う（拾い直しは scene 側でも行う）。
        const handle = handleRef.current;
        if (!handle) return;
        const rect = event.currentTarget.getBoundingClientRect();
        handle.setPointer(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -(((event.clientY - rect.top) / rect.height) * 2 - 1),
        );
      }}
      onClick={() => handleRef.current?.pick()}
    />
  );
}
