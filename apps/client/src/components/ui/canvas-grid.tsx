'use client';

import { useEffect, useRef } from 'react';
import type { CanvasSurface } from '@/lib/canvas/use-canvas-viewport';

interface CanvasGridProps {
  canvas: CanvasSurface;
  /** 目盛りの間隔（world 単位）。 */
  size?: number;
  /** 線の色。CSS の色文字列。 */
  color?: string;
  opacity?: number;
}

const DEFAULT_SIZE = 40;

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
      const step = size * vp.scale;
      el.style.backgroundSize = `${step}px ${step}px`;
      // world 原点のスクリーン位置＝そのままタイルの原点。これで方眼が world に貼り付く。
      el.style.backgroundPosition = `${vp.x}px ${vp.y}px`;
      // 引ききって目が詰まりすぎたら消す（線だらけの灰色面になるのを防ぐ）。
      el.style.opacity = step < 6 ? '0' : String(opacity);
    });
  }, [subscribe, size, opacity]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`,
        opacity,
      }}
    />
  );
}
