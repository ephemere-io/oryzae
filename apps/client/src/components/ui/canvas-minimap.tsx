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
  /** 中身が無くても必ず含める範囲（瓶の world 箱など）。 */
  extent?: Bounds | null;
  ariaLabel: string;
}

const MINIMAP_WIDTH = 148;
const MINIMAP_HEIGHT = 100;
/** 俯瞰の縁に中身が貼り付かないよう、包含矩形をこの割合だけ広げる。 */
const MARGIN_RATIO = 0.08;

function expand(bounds: Bounds, ratio: number): Bounds {
  const mx = Math.max(bounds.width * ratio, 1);
  const my = Math.max(bounds.height * ratio, 1);
  return {
    x: bounds.x - mx,
    y: bounds.y - my,
    width: bounds.width + mx * 2,
    height: bounds.height + my * 2,
  };
}

/**
 * キャンバスの俯瞰図。中身の位置と、いま見ている範囲を小さく描く。
 *
 * **表示範囲は「中身 ∪ いま見えている範囲」** を毎フレーム取り直す。
 * 中身の外接矩形だけを枠にすると、引いて中身より広く見えた瞬間に「いま見ている範囲」が
 * 俯瞰からはみ出し、画面の状態と俯瞰の状態が食い違う（枠を縁にクランプしても
 * 「どこを見ているか」の情報は失われる）。両方を含めれば、寄っても引いても離れても
 * 関係が保たれる。
 *
 * SVG の `viewBox` を world 座標そのものにしているので、中身の矩形は world 座標のまま
 * 置くだけでよく、毎フレーム書き換えるのは viewBox と可視範囲の2つだけで済む。
 */
export function CanvasMinimap({ canvas, items, extent, ariaLabel }: CanvasMinimapProps) {
  const { subscribe, frameSize } = canvas;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const viewRectRef = useRef<SVGRectElement | null>(null);
  const dimRef = useRef<SVGPathElement | null>(null);

  const content = extent ?? unionBounds(items);
  const contentX = content?.x ?? 0;
  const contentY = content?.y ?? 0;
  const contentW = content?.width ?? 0;
  const contentH = content?.height ?? 0;

  // content は毎レンダー新しい参照になりうるので、依存は数値に展開する。
  useEffect(() => {
    return subscribe((vp) => {
      const svg = svgRef.current;
      const rect = viewRectRef.current;
      const dim = dimRef.current;
      if (!svg || !rect || !dim) return;
      const frame = frameSize();
      if (frame.width === 0 || frame.height === 0) return;

      // いま見えている world 矩形。
      const visible: Bounds = {
        x: -vp.x / vp.scale,
        y: -vp.y / vp.scale,
        width: frame.width / vp.scale,
        height: frame.height / vp.scale,
      };
      const hasContent = contentW > 0 && contentH > 0;
      const union =
        unionBounds(
          hasContent
            ? [{ x: contentX, y: contentY, width: contentW, height: contentH }, visible]
            : [visible],
        ) ?? visible;
      const area = expand(union, MARGIN_RATIO);

      svg.setAttribute('viewBox', `${area.x} ${area.y} ${area.width} ${area.height}`);

      rect.setAttribute('x', String(visible.x));
      rect.setAttribute('y', String(visible.y));
      rect.setAttribute('width', String(visible.width));
      rect.setAttribute('height', String(visible.height));

      // 可視範囲の「外側」を暗く落とす。外枠と内枠を1つのパスにして evenodd で抜く。
      dim.setAttribute(
        'd',
        `M${area.x},${area.y}H${area.x + area.width}V${area.y + area.height}H${area.x}Z` +
          `M${visible.x},${visible.y}H${visible.x + visible.width}V${visible.y + visible.height}H${visible.x}Z`,
      );
    });
  }, [subscribe, frameSize, contentX, contentY, contentW, contentH]);

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
        opacity: 0.95,
      }}
    >
      {/* viewBox は world 座標。中身は world のまま置けばよい。 */}
      <svg ref={svgRef} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        <title>{ariaLabel}</title>
        {items.map((item) => (
          <rect
            key={item.id}
            x={item.x}
            y={item.y}
            width={item.width}
            height={item.height}
            fill="var(--date-color)"
            fillOpacity={0.45}
            stroke="var(--bg)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {/* 可視範囲の外側を暗く落とす。 */}
        <path ref={dimRef} fill="rgba(74,69,65,0.26)" fillRule="evenodd" />
        {/* いま見ている範囲。 */}
        <rect
          ref={viewRectRef}
          data-verify-part="minimap-viewport"
          fill="rgba(74,158,142,0.10)"
          stroke="var(--accent)"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
