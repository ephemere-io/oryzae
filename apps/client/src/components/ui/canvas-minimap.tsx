'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useEffect, useRef } from 'react';
import type { CanvasSurface } from '@/lib/canvas/use-canvas-viewport';
import { type Bounds, unionBounds } from '@/lib/canvas/viewport';

/** 俯瞰に載せる1件。`id` は React の key に使うので中身が重なっても衝突しない。 */
interface MinimapItem extends Bounds {
  id: string;
}

interface CanvasMinimapProps {
  canvas: CanvasSurface;
  items: readonly MinimapItem[];
  /** 俯瞰の範囲（world 矩形）。省略時は items を包む矩形。 */
  extent?: Bounds | null;
  ariaLabel: string;
}

const MINIMAP_WIDTH = 148;
const MINIMAP_HEIGHT = 100;
/** 中身がミニマップの縁に貼り付かないよう内側に取る余白（ミニマップ px）。 */
const PADDING = 8;

/** world 矩形 → ミニマップ座標への写像。 */
function projection(area: Bounds) {
  const scale = Math.min(
    (MINIMAP_WIDTH - PADDING * 2) / area.width,
    (MINIMAP_HEIGHT - PADDING * 2) / area.height,
  );
  return {
    scale,
    offsetX: (MINIMAP_WIDTH - area.width * scale) / 2,
    offsetY: (MINIMAP_HEIGHT - area.height * scale) / 2,
  };
}

/**
 * キャンバスの俯瞰図。中身の位置と、いま見ている範囲を小さく描く。
 *
 * **ビューポート枠は購読（`canvas.subscribe`）で毎フレーム更新する。**
 * `canvas.viewport`（React state）はジェスチャ中に更新されないので、それを使うと
 * パン中だけ枠が止まって見える。ここは React の再描画を挟まず直接 style を書く。
 */
export function CanvasMinimap({ canvas, items, extent, ariaLabel }: CanvasMinimapProps) {
  const { subscribe, frameSize } = canvas;
  const viewRectRef = useRef<HTMLDivElement | null>(null);

  const area = extent ?? unionBounds(items);
  const areaX = area?.x ?? 0;
  const areaY = area?.y ?? 0;
  const areaW = area?.width ?? 0;
  const areaH = area?.height ?? 0;

  // area は毎レンダー新しい参照になりうるので、依存は数値に展開する。
  useEffect(() => {
    if (areaW <= 0 || areaH <= 0) return;
    const { scale, offsetX, offsetY } = projection({
      x: areaX,
      y: areaY,
      width: areaW,
      height: areaH,
    });

    return subscribe((vp) => {
      const rect = viewRectRef.current;
      if (!rect) return;
      const frame = frameSize();
      if (frame.width === 0 || frame.height === 0) return;

      // いま見えている world 矩形 → ミニマップ座標。
      const worldLeft = -vp.x / vp.scale;
      const worldTop = -vp.y / vp.scale;
      const rawLeft = offsetX + (worldLeft - areaX) * scale;
      const rawTop = offsetY + (worldTop - areaY) * scale;
      const rawRight = rawLeft + (frame.width / vp.scale) * scale;
      const rawBottom = rawTop + (frame.height / vp.scale) * scale;

      // ミニマップの内側にクランプする。引ききって可視範囲が中身より広くなると
      // 枠が完全に外へ出てしまい「どこを見ているか」が消えるため、
      // 縁に貼り付けて「全部見えている」ことを示す。
      const left = Math.max(rawLeft, 0);
      const top = Math.max(rawTop, 0);
      const right = Math.min(rawRight, MINIMAP_WIDTH);
      const bottom = Math.min(rawBottom, MINIMAP_HEIGHT);

      rect.style.left = `${left}px`;
      rect.style.top = `${top}px`;
      rect.style.width = `${Math.max(right - left, 0)}px`;
      rect.style.height = `${Math.max(bottom - top, 0)}px`;
    });
  }, [subscribe, frameSize, areaX, areaY, areaW, areaH]);

  if (!area || areaW <= 0 || areaH <= 0) return null;

  const { scale, offsetX, offsetY } = projection(area);

  return (
    <div
      {...verifyAttrs({ unit: 'CanvasMinimap', itemCount: items.length })}
      // 操作できない図（pointer-events-none）なので role="img"。
      // 素の div は aria-label を取れないため、名前を付けるにはロールが要る。
      role="img"
      aria-label={ariaLabel}
      className="pointer-events-none absolute bottom-4 right-4 z-20 overflow-hidden rounded"
      style={{
        width: MINIMAP_WIDTH,
        height: MINIMAP_HEIGHT,
        border: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg)',
        opacity: 0.9,
      }}
    >
      {/* 中身の位置。カードらしく見えるよう塗り＋縁で描く。 */}
      {items.map((item) => (
        <div
          key={item.id}
          className="absolute"
          style={{
            left: offsetX + (item.x - areaX) * scale,
            top: offsetY + (item.y - areaY) * scale,
            // 引ききっても点として見えるように最小サイズを与える。
            width: Math.max(item.width * scale, 3),
            height: Math.max(item.height * scale, 3),
            backgroundColor: 'var(--date-color)',
            // 重なったときに1枚ずつの粒が見えるよう、塗りに薄い縁を足す。
            outline: '1px solid var(--bg)',
            opacity: 0.5,
            borderRadius: 1,
          }}
        />
      ))}
      {/*
        いま見ている範囲。位置と大きさは購読側が毎フレーム書き込む。
        外側を暗く落とす「スポットライト」にすることで、枠線だけのときより
        「ここを見ている」が一目で伝わる（外周の影は親の overflow:hidden で切られる）。
      */}
      <div
        ref={viewRectRef}
        data-verify-part="minimap-viewport"
        className="absolute"
        style={{
          border: '1.5px solid var(--accent)',
          borderRadius: 2,
          backgroundColor: 'rgba(74,158,142,0.10)',
          boxShadow: '0 0 0 9999px rgba(74,69,65,0.28)',
        }}
      />
    </div>
  );
}
