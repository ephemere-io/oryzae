'use client';

import type { CSSProperties, ReactNode, PointerEvent as ReactPointerEvent } from 'react';
import type { CanvasSurface } from '@/lib/canvas/use-canvas-viewport';

interface CanvasViewportProps {
  /** {@link useCanvasViewport} の戻り値。frame/world の ref と操作をまとめて受け取る。 */
  canvas: CanvasSurface;
  ariaLabel: string;
  /**
   * world の**後ろ**に敷くスクリーン空間の背景（方眼など）。
   * world に入れると合成レイヤーが巨大化して描画が打ち切られるため、ここに置く。
   */
  background?: ReactNode;
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
  background,
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
      {background}
      <div
        ref={canvas.worldRef}
        // サイズ 0 の原点ノード。子は world 座標のまま absolute で配置する。
        //
        // `will-change: transform` は付けない。合成レイヤーが子の外接矩形まで広がるため、
        // 遠くに要素がある無限キャンバスではテクスチャ上限を超えて描画が打ち切られる
        // （画面外の背景が消える・DOM が途中で切れる）。transform は毎フレーム
        // 書き換わるのでヒントが無くてもブラウザは合成する。
        className="absolute left-0 top-0"
        style={{ transformOrigin: '0 0' }}
      >
        {children}
      </div>
      {overlay}
    </div>
  );
}
