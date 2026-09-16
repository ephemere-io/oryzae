'use client';

// verify-exempt: WebGL(three.js) の renderer と rAF を持つため孤立描画できない。
// シーンの規則は scene/*.ts の純関数テストで、実機の見え方はブラウザ確認で担保する。

import { useCallback, useEffect, useRef } from 'react';
import type { StudyLayout } from '../layout';
import { isNote, staysInStudy } from '../navigation';
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
  /** 卓上のメモの文面（訳済み、1 要素 = 1 行）。空なら置かない。scene は i18n を知らない。 */
  note: readonly string[];
  /**
   * カメラが着いてから呼ばれる。ここで `router.push` する。
   *
   * **着いてから URL を変える**のが要点。クロスフェードの間に遷移することで、
   * 開く途中で画面が切り替わるのを防ぐ。
   */
  onNavigate: (target: StudyTarget) => void;
  /** 書斎の中で完結する対象（過去月・棚）。一覧オーバーレイを開く。 */
  onOpenOverlay?: (target: StudyTarget) => void;
  /** 卓上のメモをはがした。呼び出し側が憶える（次に来たときは置かない）。 */
  onDismissNote?: () => void;
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
  note,
  onNavigate,
  onOpenOverlay,
  onDismissNote,
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
    onDismissNote,
    onHoverChange,
    onLabelPositions,
    onLeaveStart,
    onCapture,
    onReady,
  });
  callbacks.current = {
    onNavigate,
    onOpenOverlay,
    onDismissNote,
    onHoverChange,
    onLabelPositions,
    onLeaveStart,
    onCapture,
    onReady,
  };

  // メモの文面は locale が変わらない限り同じ。作り直しの引き金にはしない（下の effect）。
  const noteRef = useRef(note);
  noteRef.current = note;

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
        note: noteRef.current,
        reducedMotion: prefersReducedMotion(),
        onHoverChange: (hovered) => callbacks.current.onHoverChange?.(hovered),
        onLabelPositions: (positions) => callbacks.current.onLabelPositions?.(positions),
        onLeaveStart: (durationMs) => callbacks.current.onLeaveStart?.(durationMs),
        onCapture: (dataUrl) => callbacks.current.onCapture?.(dataUrl),
        onReady: () => callbacks.current.onReady?.(),
        onPick: (target) => {
          // 卓上のメモは押すとはがれるだけ。カメラも画面も動かさない。
          if (isNote(target)) {
            handle.dismissNote();
            callbacks.current.onDismissNote?.();
            return;
          }
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
          handle.goTo(target).then(() => {
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
