'use client';

import { useEffect, useRef } from 'react';
import type { CanvasSurface } from '@/lib/canvas/use-canvas-viewport';

interface CanvasGridProps {
  canvas: CanvasSurface;
  /** `grid`（方眼）か `cork`（コルクボードの質感）。 */
  variant?: 'grid' | 'cork';
  /** 目盛りの間隔（world 単位）。 */
  size?: number;
  /** 線の色。CSS の色文字列。 */
  color?: string;
  opacity?: number;
}

const DEFAULT_SIZE = 40;
/** コルクの粒のタイル（world 単位）。 */
const CORK_TILE = 160;
/**
 * コルクの粒。SVG の乱流ノイズを茶に染め、薄く重ねる。画像ファイルを持たず、拡大しても粒が
 * 割れない（タイルは world に貼り付く）。
 */
const CORK_NOISE = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='${CORK_TILE}' height='${CORK_TILE}'>` +
    `<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' seed='7' stitchTiles='stitch'/>` +
    `<feColorMatrix values='0 0 0 0 0.40  0 0 0 0 0.26  0 0 0 0 0.12  0 0 0 0.16 0'/></filter>` +
    `<rect width='${CORK_TILE}' height='${CORK_TILE}' filter='url(#n)'/></svg>`,
)}")`;
/**
 * コルクの地の色（板そのもの）。**淡く**。濃い茶は全体の UI から浮いた（レビュー）。質感は粒で出し、
 * 色は書斎の地に寄せる。テーマで変わるのでトークン（`--board-ground`）。
 */
const CORK_BASE = 'var(--board-ground)';

/**
 * キャンバスの方眼背景。
 *
 * **frame（スクリーン空間）に敷き、world には入れない。**
 * world 側に「十分大きな div」を置く実装だと、transform ノードの合成レイヤーが
 * その巨大な子まで含む大きさになり、ブラウザのテクスチャ上限を超えて
 * **描画が途中で打ち切られる**（＝画面外に背景が無い／DOM が切れて見える）。
 * frame は常に画面サイズなので、その問題が原理的に起きない。
 *
 * 代わりに `background-size` と `background-position` をビューポートから計算して
 * world に貼り付いているように見せる。購読（`canvas.subscribe`）で毎フレーム
 * 直接 style を書くので、React の再描画は挟まない。
 */
export function CanvasGrid({
  canvas,
  variant = 'grid',
  size = DEFAULT_SIZE,
  color = 'rgba(0,0,0,0.05)',
  opacity = 0.6,
}: CanvasGridProps) {
  const { subscribe } = canvas;
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return subscribe((vp) => {
      const el = ref.current;
      if (!el) return;
      const step = (variant === 'cork' ? CORK_TILE : size) * vp.scale;
      el.style.backgroundSize = `${step}px ${step}px`;
      // world 原点のスクリーン位置＝そのままタイルの原点。これで方眼（粒）が world に貼り付く。
      el.style.backgroundPosition = `${vp.x}px ${vp.y}px`;
      // 方眼は、引ききって目が詰まりすぎたら消す（線だらけの灰色面になるのを防ぐ）。粒は消さない。
      el.style.opacity = variant === 'grid' && step < 6 ? '0' : String(opacity);
    });
  }, [subscribe, size, opacity, variant]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={
        variant === 'cork'
          ? {
              // コルクボード: 板の色の上に粒を重ね、縁を少し落として厚みを出す。
              backgroundColor: CORK_BASE,
              backgroundImage: CORK_NOISE,
              boxShadow: 'inset 0 0 120px rgba(90,60,30,0.06)',
              opacity,
            }
          : {
              backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`,
              opacity,
            }
      }
    />
  );
}
