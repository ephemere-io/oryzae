'use client';

// verify-exempt: WebGL(three.js) の renderer と rAF を持つため孤立描画できない。
// シーンの規則は scene/*.ts の純関数テストで、実機の見え方はブラウザ確認で担保する。

import { useCallback, useEffect, useRef } from 'react';
import type { StudyLayout } from '../layout';
import { staysInStudy } from '../navigation';
import { claimScene, releaseScene, takeLiveScene } from '../scene/live';
import type { StudyTheme } from '../scene/materials';
import {
  type HoverInfo,
  initScene,
  type LabelPositions,
  type SceneListeners,
  type StudySceneHandle,
} from '../scene/scene';
import type { Sprig } from '../scene/sprig';
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
  /**
   * 出ていく遷移が終盤に入り、書斎を薄くし始めてよくなったとき。
   * `durationMs` かけて 0 にすると、カメラが着くのと同時に消え終わる。
   */
  onLeaveStart?: (durationMs: number) => void;
  /** 出ていく直前の書斎（data URL）。戻り道の地に使う。 */
  onCapture?: (dataUrl: string) => void;
  /** 最初の 1 フレームを描き終えたとき。敷いてある地を外してよい合図。 */
  onReady?: () => void;
  /** 扉（認証画面）から入ってきた直後か。真ならカメラが入り口から寄って止まる。 */
  arrival?: boolean;
  /**
   * 書斎の入口（扉の前）から始めるか。認証画面で真にする。
   *
   * 真のあいだカメラは扉の前に留まり、`handle.enterStudy()` で扉をくぐってホームへ動く。
   * **シーンは 1 つ**なので、そこに画面の切り替わりは無い。
   */
  atEntrance?: boolean;
  /** 一輪挿しに挿さる枝（七十二候）。入口を組むときだけ要る。 */
  sprig?: Sprig;
  /** シーンができた（または捨てた）とき。認証画面が扉を操作するために受け取る。 */
  onHandle?: (handle: StudySceneHandle | null) => void;
}

/** `prefers-reduced-motion` を読む。SSR とテストでは false に倒す。 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * 「押した」と「つかんで動かした」の境（px）。これより動いたらドラッグで、離したときの
 * click は押したことにしない。マウスの手ぶれとタッチの揺れを吸える程度。
 */
const DRAG_THRESHOLD_PX = 5;

export function StudyCanvas({
  state,
  layout,
  theme,
  arrival,
  atEntrance,
  sprig,
  onHandle,
  onNavigate,
  onOpenOverlay,
  onHoverChange,
  onLabelPositions,
  onLeaveStart,
  onCapture,
  onReady,
}: StudyCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<StudySceneHandle | null>(null);
  /** いま触れている指。2 本になったときだけつまみとして扱う。 */
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  /** 指を置いた時点の間隔。 */
  const pinchStartRef = useRef<number | null>(null);
  /** つまんだかどうか。離した直後の click を「押した」と誤らないための印。 */
  const pinchedRef = useRef(false);
  /**
   * 1 本の指（またはマウスの左ボタン）でつかんでいる間。押した位置と、境を越えて
   * ドラッグになったかを持つ。境を越えたら、離したときの click は「押した」にしない。
   */
  const grabRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    dragging: boolean;
  } | null>(null);

  // コールバックは ref 経由で読む。props が変わるたびにシーンを作り直すと、
  // 親が再描画しただけで canvas が組み直される。
  const callbacks = useRef({
    onNavigate,
    onOpenOverlay,
    onHoverChange,
    onLabelPositions,
    onLeaveStart,
    onCapture,
    onReady,
  });
  callbacks.current = {
    onNavigate,
    onOpenOverlay,
    onHoverChange,
    onLabelPositions,
    onLeaveStart,
    onCapture,
    onReady,
  };

  // state はレンダーのたびに新しい参照になりうる（取得が落ち着くまで数回変わる）。
  // 最新を ref で渡し、シーンの作り直しは effect の外で行う。
  const stateRef = useRef(state);
  stateRef.current = state;

  // 入ってきたかどうかはマウントの瞬間だけの話。effect の条件に入れると、
  // 定置の途中で値が変わったときにシーンごと作り直してしまう。
  const arrivalRef = useRef(arrival);
  // 入口から始めるか・枝の姿も、作るときにしか使わない。
  const entranceRef = useRef({ atEntrance, sprig });
  const onHandleRef = useRef(onHandle);
  onHandleRef.current = onHandle;

  /** 畳みかけて、まだ捨てていないシーン。組み直されたら同じものを使い続ける。 */
  const keptRef = useRef<{
    handle: StudySceneHandle;
    layout: StudyLayout;
    theme: StudyTheme;
  } | null>(null);
  /** 捨てる予定。組み直されたら取り消す。 */
  const teardownRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    /** シーンから外へ出てくる知らせの受け口。作っても引き継いでも同じものを渡す。 */
    const listeners = (scene: () => StudySceneHandle | null): SceneListeners => ({
      onHoverChange: (hovered) => callbacks.current.onHoverChange?.(hovered),
      onLabelPositions: (positions) => callbacks.current.onLabelPositions?.(positions),
      onLeaveStart: (durationMs) => callbacks.current.onLeaveStart?.(durationMs),
      onCapture: (dataUrl) => callbacks.current.onCapture?.(dataUrl),
      onReady: () => callbacks.current.onReady?.(),
      onPick: (target) => {
        // 書斎の中で完結する的（棚の背表紙・過去月の手帳）は**カメラを動かさない**。
        // 一覧は書斎の上に重なる窓であって、行き先ではない。動かしていた頃は
        // 「机の手帳が開く → 別の景色の上に一覧が出る → しばらくして書斎に戻る」と、
        // 押した物と関係のない芝居が挟まっていた。
        if (staysInStudy(target)) {
          callbacks.current.onOpenOverlay?.(target);
          return;
        }
        // 出ていく的だけカメラが動く。中身は**カメラが動く前**に決まっている
        // （targetHref が対象そのものから導く）。着いてから画面を切り替える。
        scene()
          ?.goTo(target)
          .then(() => {
            callbacks.current.onNavigate(target);
          });
      },
    });

    // 畳むのを取り消す（下の注釈）。
    if (teardownRef.current !== null) {
      clearTimeout(teardownRef.current);
      teardownRef.current = null;
    }

    /**
     * 使えるシーン。順に、**畳みかけの自分のもの → 前の画面から生きているもの → 新しく作る**。
     *
     * - 畳みかけの自分のもの: StrictMode（開発時）は effect を「組む→畳む→組む」と回す。
     *   畳んだ時点で捨てると、2 回目には引き継ぐものが無い
     * - 前の画面のもの: 認証画面で扉の前に立っていたカメラは、もうホームへ向けて動き出している
     *   （`scene/live.ts`）。作り直すとその動きが切れ、「画面が切り替わった」ように見える。
     *   入れ物と受け口を付け替えるだけなら（`handle.adopt`）、描画も動きも途切れない
     */
    const kept = keptRef.current?.layout === layout && keptRef.current.theme === theme;
    const existing =
      (kept ? keptRef.current?.handle : null) ?? takeLiveScene({ layout, theme })?.handle ?? null;

    let scene: StudySceneHandle | null = existing;
    if (scene === null) {
      // WebGL が無い環境ではシーンを作らない（呼び出し側が静止フォールバックを出す）。
      try {
        scene = initScene({
          container,
          state: stateRef.current,
          layout,
          theme,
          arrival: arrivalRef.current,
          atEntrance: entranceRef.current.atEntrance,
          sprig: entranceRef.current.sprig,
          reducedMotion: prefersReducedMotion(),
          ...listeners(() => scene),
        });
      } catch {
        return;
      }
    } else {
      existing?.adopt({ container, listeners: listeners(() => scene) });
      existing?.setState(stateRef.current);
    }

    const active = scene;
    keptRef.current = { handle: active, layout, theme };
    claimScene(active, container);
    handleRef.current = active;
    onHandleRef.current?.(active);

    return () => {
      onHandleRef.current?.(null);
      handleRef.current = null;
      /**
       * **捨てるのは次のタスクまで待つ。**
       *
       * dispose を怠ると再マウントで canvas が積み上がり、古い層のイベントだけが生き残る。
       * だが、その場で捨てると StrictMode の 2 回目や、ページの入れ替え（React は**次の画面を
       * 組んでから前の画面を畳む**）で、いま描いているシーンを殺してしまう。ひと呼吸だけ待ち、
       * その間に名乗り主が替わっていれば捨てない（`scene/live.ts`）。
       */
      teardownRef.current = window.setTimeout(() => {
        teardownRef.current = null;
        keptRef.current = null;
        if (releaseScene(active, container)) active.dispose();
      }, 0);
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

  /**
   * 2 本指のつまみ。
   *
   * 指が 2 本置かれている間だけ間隔を測り、置いた時点との比を scene へ渡す。
   * 1 本のときは何もしない（そちらは的を押す操作）。
   */
  const trackPinchDown = useCallback((pointerId: number, x: number, y: number, rect: DOMRect) => {
    pointersRef.current.set(pointerId, { x, y });
    if (pointersRef.current.size !== 2) return;
    pinchStartRef.current = pointerDistance(pointersRef.current);
    // 2 本目が置かれたらつかみはやめる（以後はつまみ）。
    if (grabRef.current) {
      grabRef.current = null;
      handleRef.current?.endDrag();
    }
    // 支点は 2 本指の中点。そこへ向かって寄る。
    const middle = pointerMiddle(pointersRef.current);
    handleRef.current?.startPinch({
      x: ((middle.x - rect.left) / rect.width) * 2 - 1,
      y: -(((middle.y - rect.top) / rect.height) * 2 - 1),
    });
  }, []);

  const trackPinchMove = useCallback((pointerId: number, x: number, y: number) => {
    const pointers = pointersRef.current;
    if (!pointers.has(pointerId)) return;
    pointers.set(pointerId, { x, y });
    const start = pinchStartRef.current;
    if (pointers.size !== 2 || start === null || start === 0) return;
    pinchedRef.current = true;
    handleRef.current?.pinchTo(pointerDistance(pointers) / start);
  }, []);

  const endPinch = useCallback(() => {
    pointersRef.current.clear();
    pinchStartRef.current = null;
  }, []);

  const releasePinch = useCallback((pointerId: number) => {
    pointersRef.current.delete(pointerId);
    // 片方だけ離しても、残った指を「新しいつまみの始まり」にはしない。
    if (pointersRef.current.size < 2) pinchStartRef.current = null;
  }, []);

  /** つかみの終わり。ドラッグしていたらその印を click まで残す。 */
  const releaseGrab = useCallback((pointerId: number): boolean => {
    const grab = grabRef.current;
    if (!grab || grab.pointerId !== pointerId) return false;
    grabRef.current = null;
    handleRef.current?.endDrag();
    return grab.dragging;
  }, []);
  /** 直前のつかみがドラッグだったか。離した直後の click を「押した」にしないための印。 */
  const draggedRef = useRef(false);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      // canvas 自体がポインタを受ける。3D の物が的で、ラベルは上に重なる。
      // 2 本指のつまみを受けるため、ブラウザのページズームには渡さない。
      style={{ touchAction: 'none' }}
      onWheel={(event) => handleRef.current?.zoomBy(event.deltaY)}
      onPointerMove={(event) => {
        const handle = handleRef.current;
        if (!handle) return;
        const rect = event.currentTarget.getBoundingClientRect();
        handle.setPointer(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -(((event.clientY - rect.top) / rect.height) * 2 - 1),
        );
        trackPinchMove(event.pointerId, event.clientX, event.clientY);

        // つかんで動かす。境を越えたらドラッグになり、以後は動いた分だけ絵が付いてくる。
        const grab = grabRef.current;
        if (grab && grab.pointerId === event.pointerId && pointersRef.current.size < 2) {
          if (!grab.dragging) {
            const moved = Math.hypot(event.clientX - grab.startX, event.clientY - grab.startY);
            if (moved < DRAG_THRESHOLD_PX) return;
            grab.dragging = true;
            handle.beginDrag();
          }
          handle.dragBy(event.clientX - grab.lastX, event.clientY - grab.lastY);
          grab.lastX = event.clientX;
          grab.lastY = event.clientY;
        }
      }}
      onPointerLeave={(event) => {
        handleRef.current?.clearPointer();
        endPinch();
        draggedRef.current = releaseGrab(event.pointerId) || draggedRef.current;
      }}
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
        trackPinchDown(event.pointerId, event.clientX, event.clientY, rect);

        // 左ボタン／1 本の指だけをつかみにする。ドラッグになるかは動いてから決める。
        if (event.button === 0 && pointersRef.current.size < 2 && !grabRef.current) {
          draggedRef.current = false;
          grabRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            lastX: event.clientX,
            lastY: event.clientY,
            dragging: false,
          };
          // つかんでいる間は canvas の外へ出てもポインタを追う。合成イベント
          // （テスト・一部の環境）では有効なポインタが無く投げるので、握れなくても続ける。
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // 追えないだけ。つかみ自体は成立する。
          }
        }
      }}
      onPointerUp={(event) => {
        releasePinch(event.pointerId);
        draggedRef.current = releaseGrab(event.pointerId) || draggedRef.current;
      }}
      onPointerCancel={(event) => {
        releasePinch(event.pointerId);
        draggedRef.current = releaseGrab(event.pointerId) || draggedRef.current;
      }}
      onClick={() => {
        // つまんだ指・つかんで動かした指を離した直後の click は「押した」ではない。
        if (pinchedRef.current || draggedRef.current) {
          pinchedRef.current = false;
          draggedRef.current = false;
          return;
        }
        handleRef.current?.pick();
      }}
    />
  );
}

/** 2 点の距離。指が 2 本のときだけ呼ぶ。 */
function pointerDistance(pointers: Map<number, { x: number; y: number }>): number {
  const [a, b] = [...pointers.values()];
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** 2 点の中点（client 座標）。指が 2 本のときだけ呼ぶ。 */
function pointerMiddle(pointers: Map<number, { x: number; y: number }>): {
  x: number;
  y: number;
} {
  const [a, b] = [...pointers.values()];
  if (!a || !b) return { x: 0, y: 0 };
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
