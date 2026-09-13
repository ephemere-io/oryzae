'use client';

import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';

/**
 * シート（下から出る板）の指の動き。`BottomSheet`（モーダル）と `DockSheet`（非モーダル）が
 * **同じ手**で動くように、ここに 1 つだけ置く。
 *
 * Google マップのシートの作法（オーナーの観察）:
 * - 指を置いた直後に縦か横かを確定。横ならシートは動かない
 * - 半分の段で中身を上に払うと、**中身は動かずシートが上がる**。いちばん高い段に着いた瞬間、指を離さない
 *   まま中身がスクロールし始める。戻すときは逆（中身が先頭に着いたらシートが下がる）
 * - 離せば近い段へ。速く払えば、その向きの次の段へ
 *
 * これを 1 本の指の動きの中で受け渡すには、**中身のスクロールもこちらで動かす**必要がある
 * （ブラウザに任せると、ブラウザが掴んだ時点で pointer が cancel され、途中で取り返せない）。
 * だから板は `touch-action: none`、中身の `scrollTop` を指の残りぶんで書き、離したら慣性を自前で付ける。
 * マウスのホイールは指の動きではないので、そのままブラウザに任せる（`overflow: auto` のまま）。
 *
 * 動きは **window で受ける**（板に置いた瞬間から離すまで）。板の上で受けると、マウスでは最初の一歩で
 * 板の外へ出た動きが届かず、掴めない（指には暗黙の capture があるが、マウスには無い）。
 */

export interface SheetGestureOptions {
  panelRef: RefObject<HTMLElement | null>;
  contentRef: RefObject<HTMLElement | null>;
  /** いま止まっている見える高さ（px）。掴んだ瞬間の基準。 */
  restingHeight: () => number;
  /** いちばん低い段の高さ（px）。閉じられる板なら、これより下へも引ける。 */
  minHeight: () => number;
  maxHeight: () => number;
  /** いちばん低い段より下へ引けるか（引き切ると閉じる）。 */
  dismissible: boolean;
  /** 引いている間、見える高さを描く（transform を書く）。 */
  render: (visible: number) => void;
  /**
   * 離したとき。`visible` は離した瞬間の見える高さ、`velocity` は px/ms（正 = 下向き）。
   * 段へ収める・閉じるは呼び出し側が決める。
   */
  onRelease: (visible: number, velocity: number) => void;
}

/** これ未満の動きは押したとみなす（px）。縦か横かもここで決める。 */
const SLOP = 4;
/** 速度を測る窓（ms）。 */
const VELOCITY_WINDOW_MS = 90;
/** 慣性の減衰（1 フレームあたり）。 */
const FLING_FRICTION = 0.94;
const FLING_MIN_VELOCITY = 0.03;

interface Sample {
  t: number;
  y: number;
}

interface Drag {
  pointerId: number;
  startX: number;
  startY: number;
  lastY: number;
  /** 掴んだ時点の見える高さ。 */
  visible: number;
  axis: 'undecided' | 'vertical' | 'horizontal';
  /** 最後の動きが中身のスクロールだったか（離したら慣性を中身に付ける）。 */
  scrolledContent: boolean;
  samples: Sample[];
  /** window に張った listener を外す。 */
  detach: () => void;
}

export interface SheetGestureHandlers {
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
}

export function useSheetGesture(options: SheetGestureOptions): {
  handlers: SheetGestureHandlers;
  dragging: boolean;
  /** 直前の指が動いたか（動いたあとの click を「押した」と数えないため）。 */
  movedRef: RefObject<boolean>;
} {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const dragRef = useRef<Drag | null>(null);
  const movedRef = useRef(false);
  const flingRef = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const stopFling = useCallback(() => {
    if (flingRef.current !== null) {
      cancelAnimationFrame(flingRef.current);
      flingRef.current = null;
    }
  }, []);
  // 外れるときは慣性と window の listener を片付ける。
  useEffect(
    () => () => {
      stopFling();
      dragRef.current?.detach();
      dragRef.current = null;
    },
    [stopFling],
  );

  /** 中身に慣性を付ける（ブラウザの代わり）。端に着いたら止める。 */
  const fling = useCallback((velocity: number) => {
    const content = optionsRef.current.contentRef.current;
    if (!content) return;
    let v = velocity; // px/ms、正 = 指が下 = 中身は上へ戻る
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(now - last, 32);
      last = now;
      content.scrollTop -= v * dt;
      v *= FLING_FRICTION ** (dt / 16);
      const atEdge =
        content.scrollTop <= 0 || content.scrollTop >= content.scrollHeight - content.clientHeight;
      if (Math.abs(v) < FLING_MIN_VELOCITY || atEdge) {
        flingRef.current = null;
        return;
      }
      flingRef.current = requestAnimationFrame(step);
    };
    flingRef.current = requestAnimationFrame(step);
  }, []);

  const onMove = useCallback((event: PointerEvent) => {
    const drag = dragRef.current;
    const opts = optionsRef.current;
    const panel = opts.panelRef.current;
    if (!drag || !panel || drag.pointerId !== event.pointerId) return;

    if (drag.axis === 'undecided') {
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
      // 横に確定したらシートは動かない（写真の帯を横に払うとき等）。
      if (Math.abs(dx) > Math.abs(dy)) {
        drag.axis = 'horizontal';
        drag.detach();
        dragRef.current = null;
        return;
      }
      drag.axis = 'vertical';
      drag.lastY = event.clientY;
      movedRef.current = true;
      panel.style.transition = 'none';
      setDragging(true);
    }

    const step = event.clientY - drag.lastY; // 正 = 指が下へ
    drag.lastY = event.clientY;
    const now = performance.now();
    drag.samples.push({ t: now, y: event.clientY });
    while (drag.samples.length > 2 && now - (drag.samples[0]?.t ?? now) > VELOCITY_WINDOW_MS) {
      drag.samples.shift();
    }
    if (step === 0) return;

    const content = opts.contentRef.current;
    const max = opts.maxHeight();
    const min = opts.dismissible ? 0 : opts.minHeight();

    if (step < 0) {
      // 上へ: まず板を上げ、いちばん高い段に着いたら残りで中身をスクロール。
      const room = Math.max(0, max - drag.visible);
      const take = Math.min(-step, room);
      drag.visible += take;
      const rest = -step - take;
      if (rest > 0 && content) {
        content.scrollTop += rest;
        drag.scrolledContent = true;
      } else {
        drag.scrolledContent = false;
      }
    } else {
      // 下へ: まず中身を先頭へ戻し、先頭に着いたら残りで板を下げる。
      let rest = step;
      if (content && content.scrollTop > 0) {
        const scrolled = Math.min(step, content.scrollTop);
        content.scrollTop -= scrolled;
        rest = step - scrolled;
        drag.scrolledContent = rest === 0;
      } else {
        drag.scrolledContent = false;
      }
      drag.visible = Math.max(min, drag.visible - rest);
    }
    opts.render(drag.visible);
  }, []);

  const onEnd = useCallback(
    (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      drag.detach();
      dragRef.current = null;
      if (drag.axis !== 'vertical') return;
      setDragging(false);

      // 直近の窓での速度（px/ms、正 = 下）。
      const first = drag.samples[0];
      const last = drag.samples[drag.samples.length - 1];
      const velocity =
        first && last && last.t > first.t ? (last.y - first.y) / (last.t - first.t) : 0;

      if (drag.scrolledContent) {
        // 中身をスクロールしていた: 板はいちばん高い段のまま、中身に慣性。
        fling(velocity);
        optionsRef.current.onRelease(drag.visible, 0);
        return;
      }
      optionsRef.current.onRelease(drag.visible, velocity);
    },
    [fling],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      stopFling();
      dragRef.current?.detach();
      movedRef.current = false;
      const detach = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onEnd);
        window.removeEventListener('pointercancel', onEnd);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onEnd);
      window.addEventListener('pointercancel', onEnd);
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastY: event.clientY,
        visible: optionsRef.current.restingHeight(),
        axis: 'undecided',
        scrolledContent: false,
        samples: [{ t: performance.now(), y: event.clientY }],
        detach,
      };
    },
    [stopFling, onMove, onEnd],
  );

  return { handlers: { onPointerDown }, dragging, movedRef };
}

/** 速く払ったとみなす速さ（px/ms）。 */
const FLICK_VELOCITY = 0.5;

/**
 * 離した高さと速さから、止まる段を選ぶ。段は高さ（px）の昇順。
 * 速く払えばその向きの次の段、そうでなければいちばん近い段。
 */
export function pickDetent(
  heights: readonly number[],
  visible: number,
  velocity: number,
  from: number,
): number {
  if (heights.length === 0) return 0;
  if (velocity < -FLICK_VELOCITY) return Math.min(from + 1, heights.length - 1);
  if (velocity > FLICK_VELOCITY) return Math.max(from - 1, 0);
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  heights.forEach((height, index) => {
    const distance = Math.abs(height - visible);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}
