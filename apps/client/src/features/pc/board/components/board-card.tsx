'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useCallback, useRef } from 'react';
import type { BoardCardData } from '@/features/shared/board/types';
import { HANDLE_SIZE, hairline, INVERSE_SCALE } from './board-surface';
import { CardTextGlyph } from './card-text-glyph';
import { PhotoCardContent } from './photo-card-content';
import { SnippetCardContent } from './snippet-card-content';

/**
 * 倍率に応じた描画の詳しさ（意味的ズーム）。
 * 引いた状態で全文を描くのは読めないうえ無駄なので、段階的に中身を落とす。
 */
export type CardDetail = 'block' | 'title' | 'full';

interface BoardCardProps {
  card: BoardCardData;
  /** 既定は 'full'（キャンバス外で単体表示するとき用）。 */
  detail?: CardDetail;
  isSelected: boolean;
  /** つまみ（回転・大きさ）を出すか。複数選んでいる間は群の枠に譲る。 */
  showHandles: boolean;
  isDragging: boolean;
  /** `additive` は Shift 押下。選択に足す／外す（1 枚だけ選び直さない）。 */
  onPointerDown: (cardId: string, x: number, y: number, additive: boolean) => void;
  onRotateStart: (
    cardId: string,
    centerX: number,
    centerY: number,
    pointerX: number,
    pointerY: number,
  ) => void;
  onResizeStart: (cardId: string, corner: 'se' | 'sw' | 'ne' | 'nw', x: number, y: number) => void;
  onClick: (card: BoardCardData) => void;
}

function isSnippetContent(content: BoardCardData['content']): content is { text: string } {
  return 'text' in content;
}

function isPhotoContent(
  content: BoardCardData['content'],
): content is { imageUrl: string; caption: string } {
  return 'imageUrl' in content;
}

/**
 * 簡略度が切り替わる倍率。`detailForScale`（board-view）と、下の重ね合わせの
 * 両方がここを見る。**ずれると入れ替えの瞬間に段差が出る**ので一箇所に置く。
 */
export const DETAIL_THRESHOLD_TITLE = 0.28;
export const DETAIL_THRESHOLD_FULL = 0.45;
/** 文字と図が入れ替わる帯の幅。この区間で両方が重なってすれ違う。 */
const LOD_FADE_SPAN = 0.06;
const LOD_FADE_END = 0.34; // = DETAIL_THRESHOLD_TITLE + LOD_FADE_SPAN

/**
 * 文字と図の入れ替えは、**`detail` の切り替わりではなく倍率そのもの**に追従させる。
 *
 * `detail` は React の state から来るので、ホイールが止まって 120ms 経つまで変わらない。
 * そこで出し分けると「引いても何も起きず、指を止めた瞬間に全部入れ替わる」動きになる。
 * `--vp-scale` は毎フレーム書かれるため、CSS で不透明度を作れば**再描画ゼロのまま**
 * 操作に追従する。DOM の出し入れ自体は不透明度が 0 の側で起きるので目に見えない。
 */
const GLYPH_OPACITY = `clamp(0, calc((${LOD_FADE_END} - var(--vp-scale, 1)) / ${LOD_FADE_SPAN}), 1)`;
const TEXT_OPACITY = `clamp(0, calc((var(--vp-scale, 1) - ${DETAIL_THRESHOLD_TITLE}) / ${LOD_FADE_SPAN}), 1)`;

export function BoardCard({
  card,
  detail = 'full',
  isSelected,
  showHandles,
  isDragging,
  onPointerDown,
  onRotateStart,
  onResizeStart,
  onClick,
}: BoardCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      onPointerDown(card.id, e.clientX, e.clientY, e.shiftKey);
    },
    [card.id, onPointerDown],
  );

  const handleRotateDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      onRotateStart(
        card.id,
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        e.clientX,
        e.clientY,
      );
    },
    [card.id, onRotateStart],
  );

  const handleResizeDown = useCallback(
    (corner: 'se' | 'sw' | 'ne' | 'nw') => (e: React.PointerEvent) => {
      e.stopPropagation();
      onResizeStart(card.id, corner, e.clientX, e.clientY);
    },
    [card.id, onResizeStart],
  );

  return (
    <div
      ref={cardRef}
      data-card-id={card.id}
      // 掴んだらカードを動かす（キャンバスのパンを始めない）。
      data-canvas-no-pan=""
      className="board-card"
      // ヘルプが開いているとき、カードに触れたら灯す見取り図の部品。抜き書きは「スニペット」、
      // 写真は「写真」（前は「ボード」で、ボードの見取り図のどこも灯らなかった）。
      data-help={
        card.cardType === 'snippet' ? 'snippet' : card.cardType === 'photo' ? 'photo' : 'board'
      }
      {...verifyAttrs({
        unit: 'BoardCard',
        cardType: card.cardType,
        detail,
        selected: isSelected,
        handles: showHandles,
        dragging: isDragging,
        rotation: card.rotation,
        removing: Boolean(card.removing),
      })}
      style={{
        position: 'absolute',
        left: card.x,
        top: card.y,
        width: card.width,
        height: card.height,
        transform: `rotate(${card.rotation}deg)`,
        zIndex: isDragging ? 1000 : card.zIndex,
        cursor: isDragging ? 'grabbing' : 'grab',
        borderRadius: 2,
        backgroundColor:
          card.cardType === 'snippet'
            ? 'var(--card-snippet, #FFFBE0)'
            : card.cardType === 'photo'
              ? 'var(--card-photo, #ffffff)'
              : 'var(--bg)',
        border: `${hairline(1)} solid var(--border-subtle)`,
        boxShadow: isDragging
          ? '0 20px 40px rgba(0,0,0,0.15)'
          : '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.03)',
        outline: isSelected ? `${hairline(1.5)} solid rgba(74,158,142,0.5)` : 'none',
        outlineOffset: isSelected ? hairline(4) : 0,
        overflow: isSelected ? 'visible' : 'hidden',
        // 編集中だけ文字を選べるようにする。常に選べると、掴んで動かそうとした
        // だけで選択が始まってカードが動かせない。
        userSelect: 'none',
        touchAction: 'none',
        animation: card.removing
          ? 'itemRemove 0.28s ease forwards'
          : 'popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        pointerEvents: card.removing ? 'none' : 'auto',
        transition: 'box-shadow 0.2s ease',
      }}
      onPointerDown={handlePointerDown}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onClick(card);
      }}
    >
      {/* 全面を覆う透明ボタンは置かない。以前はダブルクリックの的として敷いていたが、
          それがカードの文字を一切選べなくしていた（コピーもできなかった）。
          ダブルクリックはカード本体で受ける。 */}

      {/* 引ききった状態では **文字だけ** 落とす。読めない文字を枚数分描くのは無駄だが、
          写真は縮んでも何の写真か分かるので落とさない。落とすと白い矩形になり
          「写真が表示されない」ように見える（PR #533 のレビュー指摘）。

          ただし文字を落とした跡を空白のままにすると、今度は中身が無いカードと
          見分けが付かない（同レビューの2度目の指摘）。行の並びだけを図として残す。

          図と文字は重ねて置き、すれ違わせる。どちらも `absolute inset-0` なので
          帯の中では同じ場所に重なり、`--vp-scale` 由来の不透明度で入れ替わる。 */}
      {detail !== 'full' && card.cardType === 'snippet' && (
        <div
          data-verify-part="glyph-layer"
          className="pointer-events-none absolute inset-0"
          style={{ opacity: GLYPH_OPACITY }}
        >
          <CardTextGlyph />
        </div>
      )}
      {detail !== 'block' && card.cardType === 'snippet' && isSnippetContent(card.content) && (
        <div
          data-verify-part="text-layer"
          className="absolute inset-0"
          style={{ opacity: TEXT_OPACITY }}
        >
          <SnippetCardContent content={card.content} cardWidth={card.width} />
        </div>
      )}
      {card.cardType === 'photo' && isPhotoContent(card.content) && (
        <PhotoCardContent content={card.content} captionHidden={detail === 'block'} />
      )}

      {/* つまみは 1 枚だけ選んでいるときに出す。複数選んでいるときは、群を囲む枠
          （SelectionFrame）が代わりに持つ——カードごとに角が出ていると、どれを掴めば
          群ごと変わるのか分からない。 */}
      {isSelected && showHandles && (
        <>
          {/* 右上に削除（バツ）は置かない。同じ操作が道具箱にあり、消す手が 2 つに
              割れていた。加えて、バツが右上を塞いでいたせいで**リサイズのつまみが
              3 隅しか無かった**（`ne` が欠けていた）。角は 4 つとも大きさを変える手に
              使い、消すのは道具箱の 1 か所に寄せる。 */}

          {/* Rotate handle */}
          <div
            role="slider"
            tabIndex={0}
            aria-label="Rotate card"
            aria-valuemin={-180}
            aria-valuemax={180}
            aria-valuenow={card.rotation}
            onPointerDown={handleRotateDown}
            onKeyDown={(e) => e.stopPropagation()}
            className="absolute left-1/2 flex items-center justify-center rounded-full"
            style={{
              bottom: -36,
              transform: `translateX(-50%) ${INVERSE_SCALE}`,
              width: 28,
              height: 28,
              backgroundColor: 'var(--bg)',
              border: '2px solid var(--accent)',
              opacity: 1,
              cursor: 'grab',
              zIndex: 10,
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="1.2"
              aria-hidden="true"
            >
              <path d="M9 3a4.5 4.5 0 1 0 .5 4.5M9 1v3h-3" />
            </svg>
          </div>

          {/* Resize handles（4 隅）。 */}
          {(['se', 'sw', 'ne', 'nw'] as const).map((corner) => {
            const style: React.CSSProperties = {
              position: 'absolute',
              width: HANDLE_SIZE,
              height: HANDLE_SIZE,
              backgroundColor: 'var(--bg)',
              border: '1.5px solid var(--accent)',
              borderRadius: 2,
              zIndex: 10,
              transform: INVERSE_SCALE,
            };
            if (corner.includes('s')) style.bottom = -10;
            if (corner.includes('n')) style.top = -10;
            if (corner.includes('e')) style.right = -10;
            if (corner.includes('w')) style.left = -10;
            style.cursor = `${corner}-resize`;

            return (
              <div
                key={corner}
                data-verify-handle={corner}
                onPointerDown={handleResizeDown(corner)}
                style={style}
              />
            );
          })}
        </>
      )}
    </div>
  );
}
