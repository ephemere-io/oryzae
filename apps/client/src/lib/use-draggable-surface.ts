'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 画面に浮かぶ面を、掴んで動かせるようにする。
 *
 * エントリーの操作パレットが持っていた振る舞いをここへ出した。ボードのツールバーにも
 * 同じことを求められた（PR #570）ので、**2 か所で同じ挙動が要る**時点でここが置き場に
 * なる。`lib` はドメインを知らないので、置いているのは「面を掴んで動かす」だけ。
 *
 * 面の見た目・畳み方・既定位置は呼び出し側が決める。ここが返すのは
 * 「いまどこに居るか（`anchor`）」と「掴む口（`onPointerDown`）」の 2 つ。
 */

/** 端からの余白（px）。これより内側には入れない。 */
const EDGE_MARGIN = 12;

/** これだけ動いて初めて「掴んだ」と見なす（px）。下回ればボタンのクリックとして通す。 */
const DRAG_THRESHOLD = 4;

/**
 * 面の居場所。**画面の左上からの px ではなく、近いほうの端からの距離で持つ。**
 *
 * 左上からの px で持つと、窓が縦に伸びたときに伸びたぶんが丸ごと下の余白になる。
 * 全画面はまさにそれで、ブラウザのヘッダーが消えたぶん窓が高くなり、下に置いたはずの
 * 面が画面の中ほどまで浮き上がって見えていた。
 *
 * 端からの距離なら、下に置いたものは下に、右に置いたものは右に残る。
 * **ヘッダーの高さを数える必要がない**ので、ブラウザや OS が変わっても同じように効く。
 */
export interface SurfaceAnchor {
  xEdge: 'left' | 'right';
  x: number;
  yEdge: 'top' | 'bottom';
  y: number;
}

interface Size {
  w: number;
  h: number;
}

function isEdgeX(value: unknown): value is 'left' | 'right' {
  return value === 'left' || value === 'right';
}

function isEdgeY(value: unknown): value is 'top' | 'bottom' {
  return value === 'top' || value === 'bottom';
}

function readStoredAnchor(key: string | null): SurfaceAnchor | null {
  if (key === null || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'x' in parsed &&
      'y' in parsed &&
      'xEdge' in parsed &&
      'yEdge' in parsed &&
      typeof parsed.x === 'number' &&
      typeof parsed.y === 'number' &&
      isEdgeX(parsed.xEdge) &&
      isEdgeY(parsed.yEdge)
    ) {
      return { xEdge: parsed.xEdge, x: parsed.x, yEdge: parsed.yEdge, y: parsed.y };
    }
  } catch {
    // 壊れた値・localStorage 不許可。既定位置に落とす。
  }
  return null;
}

function persistAnchor(key: string | null, anchor: SurfaceAnchor): void {
  if (key === null || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(anchor));
  } catch {
    // 保存できなくても操作は続けられる。
  }
}

/**
 * 画面の中に収めたうえで、**近いほうの端**に留める。
 *
 * @param size 面の寸法。**呼び出し側が渡す**のが肝心で、ここで offsetWidth を読むと
 *   pointermove のたびにレイアウトが同期的に走る。本文の contentEditable とゴーストの
 *   キャンバスを抱えた画面ではそれが数百 ms の詰まりになる（実測: INP の警告
 *   「Event handlers on this element blocked UI updates for 576ms」）。
 */
function toAnchor(left: number, top: number, size: Size): SurfaceAnchor {
  const maxX = Math.max(EDGE_MARGIN, window.innerWidth - size.w - EDGE_MARGIN);
  const maxY = Math.max(EDGE_MARGIN, window.innerHeight - size.h - EDGE_MARGIN);
  const clampedLeft = Math.min(Math.max(EDGE_MARGIN, left), maxX);
  const clampedTop = Math.min(Math.max(EDGE_MARGIN, top), maxY);
  const rightGap = Math.max(EDGE_MARGIN, window.innerWidth - clampedLeft - size.w);
  const bottomGap = Math.max(EDGE_MARGIN, window.innerHeight - clampedTop - size.h);
  const nearLeft = clampedLeft <= rightGap;
  const nearTop = clampedTop <= bottomGap;
  return {
    xEdge: nearLeft ? 'left' : 'right',
    x: nearLeft ? clampedLeft : rightGap,
    yEdge: nearTop ? 'top' : 'bottom',
    y: nearTop ? clampedTop : bottomGap,
  };
}

/** 窓が縮んで端からの距離が入らなくなったときに引き戻す。端の選択は変えない。 */
function clampAnchor(anchor: SurfaceAnchor, size: Size): SurfaceAnchor {
  const maxX = Math.max(EDGE_MARGIN, window.innerWidth - size.w - EDGE_MARGIN);
  const maxY = Math.max(EDGE_MARGIN, window.innerHeight - size.h - EDGE_MARGIN);
  return {
    ...anchor,
    x: Math.min(Math.max(EDGE_MARGIN, anchor.x), maxX),
    y: Math.min(Math.max(EDGE_MARGIN, anchor.y), maxY),
  };
}

/** `anchor` を CSS の位置指定に落とす。動かされていなければ null（既定位置は呼び出し側）。 */
export function anchorStyle(anchor: SurfaceAnchor | null): React.CSSProperties | null {
  if (anchor === null) return null;
  // 端は動的なキーになるが、`as` を使わずに書ける（分岐ごとに素直に組む）。
  return {
    ...(anchor.yEdge === 'top' ? { top: anchor.y } : { bottom: anchor.y }),
    ...(anchor.xEdge === 'left' ? { left: anchor.x } : { right: anchor.x }),
  };
}

export interface DraggableSurface {
  /** いまの居場所。まだ動かされていなければ null。 */
  anchor: SurfaceAnchor | null;
  /** 掴んでいる最中か。 */
  dragging: boolean;
  /** 面のルートに付ける ref（寸法を測るのに要る）。 */
  rootRef: React.RefObject<HTMLDivElement | null>;
  /** 面のどこでも掴めるようにする。ボタンの上でも付けてよい（下の注釈を参照）。 */
  onPointerDown: (event: React.PointerEvent) => void;
  /**
   * 直前の操作が「掴んで動かした」だったか。**読むと下がる**（1 回のクリック判定で
   * 1 度だけ効く）。ボタンの `onClick` の先頭で読み、true ならクリックを捨てる。
   */
  consumeMoved: () => boolean;
}

/**
 * @param storageKey 位置を憶える localStorage の鍵。null なら憶えない。
 */
export function useDraggableSurface(storageKey: string | null = null): DraggableSurface {
  const [anchor, setAnchor] = useState<SurfaceAnchor | null>(null);
  const [dragging, setDragging] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  // ドラッグ中に読む面の寸法。**掴んだ瞬間に一度だけ測る**（toAnchor の注釈を参照）。
  const dragSizeRef = useRef<Size>({ w: 240, h: 48 });
  // 次のフレームまで位置の反映を 1 回にまとめる（pointermove は 1 フレームに何度も来る）。
  const pendingRef = useRef<SurfaceAnchor | null>(null);
  const frameRef = useRef<number | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const movedRef = useRef(false);

  // 初回だけ localStorage から復元する（SSR では読めないので mount 後）。
  useEffect(() => {
    setAnchor(readStoredAnchor(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (!dragging) return;

    function flush() {
      frameRef.current = null;
      const next = pendingRef.current;
      if (next) setAnchor(next);
    }
    function handleMove(e: PointerEvent) {
      if (!movedRef.current) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        // 指 1 本ぶんも動いていないなら、それは「掴んだ」ではなく「押した」。
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        movedRef.current = true;
      }
      pendingRef.current = toAnchor(
        e.clientX - dragOffsetRef.current.x,
        e.clientY - dragOffsetRef.current.y,
        dragSizeRef.current,
      );
      if (frameRef.current === null) frameRef.current = requestAnimationFrame(flush);
    }
    function handleUp() {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      if (pendingRef.current) setAnchor(pendingRef.current);
      setDragging(false);
    }
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [dragging]);

  // 手を離した位置を憶える。
  useEffect(() => {
    if (dragging || anchor === null) return;
    persistAnchor(storageKey, anchor);
  }, [storageKey, dragging, anchor]);

  // 窓を縮めると面が画面外へ出るので、そのつど引き戻す。
  // **全画面の出入りもここに乗せる** — resize が来る保証がないブラウザがある。
  useEffect(() => {
    if (anchor === null) return;
    function handleResize() {
      const el = rootRef.current;
      const size: Size = { w: el?.offsetWidth ?? 240, h: el?.offsetHeight ?? 48 };
      setAnchor((a) => (a === null ? a : clampAnchor(a, size)));
    }
    window.addEventListener('resize', handleResize);
    document.addEventListener('fullscreenchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('fullscreenchange', handleResize);
    };
  }, [anchor]);

  /**
   * 面のどこを掴んでもドラッグを始める。**ボタンの上も含む。**
   *
   * ボタンの上を `closest` で弾いていたころ、面はほぼ全域がボタンで（実測: 面 250px 中
   * 248px）、掴める余白は外周に数 px しか残らなかった。掴んだつもりが動かない、が
   * 起きるのはこれが理由。代わりに**動いた距離**で区別する。
   */
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    dragSizeRef.current = { w: rect.width, h: rect.height };
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    movedRef.current = false;
    const startAnchor = toAnchor(rect.left, rect.top, dragSizeRef.current);
    pendingRef.current = startAnchor;
    setAnchor(startAnchor);
    setDragging(true);
  }, []);

  const consumeMoved = useCallback(() => {
    if (!movedRef.current) return false;
    movedRef.current = false;
    return true;
  }, []);

  return { anchor, dragging, rootRef, onPointerDown, consumeMoved };
}
