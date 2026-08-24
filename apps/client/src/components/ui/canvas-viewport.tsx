'use client';

import type { CSSProperties, ReactNode, PointerEvent as ReactPointerEvent } from 'react';
import type { CanvasSurface } from '@/lib/canvas/use-canvas-viewport';

interface CanvasViewportProps {
  /** {@link useCanvasViewport} の戻り値。frame/world の ref と操作をまとめて受け取る。 */
  canvas: CanvasSurface;
  ariaLabel: string;
  /** スクリーン空間の UI（ズームコントロール・ナビ）。倍率の影響を受けない。 */
  overlay?: ReactNode;
  /** world 空間の中身。world 座標のまま `position: absolute` で置く。 */
  children: ReactNode;
  onPointerMove?: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onClick?: () => void;
  style?: CSSProperties;
}

/**
 * パン・ズームするキャンバスの枠。
 *
 * 構造は「frame（固定・overflow hidden）→ world（transform 1枚）→ 中身」の3層だけ。
 * transform を1ノードに集約しているのでコンポジタだけで動き、子は通常どおりの DOM で書ける。
 *
 * **transform と `--vp-scale` を書くのは {@link useCanvasViewport} だけ**（style prop に
 * 置かない）。ジェスチャ中に別要因の再描画が入っても、古い値で上書きされて画面が飛ばない。
 */
export function CanvasViewport({
  canvas,
  ariaLabel,
  overlay,
  children,
  onPointerMove,
  onPointerUp,
  onClick,
  style,
}: CanvasViewportProps) {
  return (
    <div
      ref={canvas.frameRef}
      role="application"
      aria-label={ariaLabel}
      className="absolute inset-0 overflow-hidden"
      style={{
        // ブラウザのピンチズーム・戻るスワイプ・バウンスを止める。
        // これが無いと ctrl+wheel がページ全体のズームに吸われる。
        touchAction: 'none',
        overscrollBehavior: 'none',
        cursor: canvas.isPanning ? 'grabbing' : 'default',
        ...style,
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={onClick}
      onKeyDown={() => {}}
    >
      <div
        ref={canvas.worldRef}
        // サイズ 0 の原点ノード。子は world 座標のまま absolute で配置する。
        className="absolute left-0 top-0"
        style={{ transformOrigin: '0 0', willChange: 'transform' }}
      >
        {children}
      </div>
      {overlay}
    </div>
  );
}
