'use client';

import { type PointerEvent, useCallback, useEffect, useRef, useState } from 'react';

/** 横ドラッグ何 px で 1 段めくるか。 */
const DRAG_PX_PER_STEP = 90;
/** ホイールの累積が何に達したら 1 段めくるか。 */
const WHEEL_PER_STEP = 60;
/** ホイールの累積をこの無操作時間でリセットする（惰性スクロールが暴れないように）。 */
const WHEEL_IDLE_MS = 260;

interface UseCoverFlowInputOptions {
  /** 履歴を開いているか。false の間は一切反応しない。 */
  active: boolean;
  /** 相対でめくる（-1 が過去、+1 が未来）。端では呼び出し側が握りつぶす。 */
  onStep: (delta: number) => void;
  /** ESC で閉じる。 */
  onClose: () => void;
}

interface UseCoverFlowInputResult {
  /** ドラッグ中。円盤の transition を切るのに使う（追従を優先する）。 */
  dragging: boolean;
  onWheel: (e: { deltaX: number; deltaY: number }) => void;
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
}

/**
 * 発酵履歴（Cover Flow）のめくり操作。← → キー・横ドラッグ・ホイールを 1 か所に集める。
 *
 * キーだけ document で拾うのは、ステージにフォーカスが乗っていなくても
 * （「瓶にもどる」ボタンを押した直後など）矢印が効いてほしいから。閉じている間は
 * リスナ自体を張らないので、瓶のキャンバス側のキー操作とは競合しない。
 */
export function useCoverFlowInput({
  active,
  onStep,
  onClose,
}: UseCoverFlowInputOptions): UseCoverFlowInputResult {
  const [dragging, setDragging] = useState(false);

  // 毎レンダー張り直さずに最新のコールバックを呼ぶための鏡。
  const stepRef = useRef(onStep);
  stepRef.current = onStep;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepRef.current(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepRef.current(1);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active]);

  /** ホイールの累積と最後に動いた時刻。 */
  const wheel = useRef({ acc: 0, at: 0 });
  /** ドラッグの起点と、そこから何段めくったか。 */
  const drag = useRef<{ startX: number; steps: number } | null>(null);

  // 閉じたら途中の累積・ドラッグを持ち越さない（次に開いたとき勝手に 1 段動く）。
  useEffect(() => {
    if (active) return;
    wheel.current = { acc: 0, at: 0 };
    drag.current = null;
    setDragging(false);
  }, [active]);

  const onWheel = useCallback((e: { deltaX: number; deltaY: number }) => {
    // トラックパッドの横スワイプと縦ホイールの両方を受ける。動きの大きい軸を採る。
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const now = Date.now();
    if (now - wheel.current.at > WHEEL_IDLE_MS) wheel.current.acc = 0;
    // 無操作の起点は「最後のイベント」であって「最後にめくった時刻」ではない。
    // めくった時だけ更新すると、しきい値に届かない小さな delta が来るたびに
    // 累積がリセットされ、細かい刻みのホイールでは永久にめくれない。
    wheel.current.at = now;
    wheel.current.acc += delta;
    if (Math.abs(wheel.current.acc) < WHEEL_PER_STEP) return;
    const direction = wheel.current.acc > 0 ? 1 : -1;
    wheel.current.acc = 0;
    stepRef.current(direction);
  }, []);

  const onPointerDown = useCallback((e: PointerEvent<HTMLElement>) => {
    // 主ボタンだけ。右クリック・中クリックは無反応。
    if (e.button !== undefined && e.button !== 0) return;
    drag.current = { startX: e.clientX, steps: 0 };
    setDragging(true);
  }, []);

  const onPointerMove = useCallback((e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    // 右へ引く＝過去へ戻る。段の総量で見て差分だけ送るので、行き過ぎて戻しても数が合う。
    const want = Math.trunc((e.clientX - d.startX) / DRAG_PX_PER_STEP);
    if (want === d.steps) return;
    stepRef.current(d.steps - want);
    d.steps = want;
  }, []);

  const onPointerUp = useCallback(() => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
  }, []);

  return { dragging, onWheel, onPointerDown, onPointerMove, onPointerUp };
}
