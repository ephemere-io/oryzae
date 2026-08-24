'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useCallback, useRef } from 'react';
import type { BoardCardData } from '@/features/shared/board/types';
import { EntryCardContent } from './entry-card-content';
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
  isDragging: boolean;
  onPointerDown: (cardId: string, x: number, y: number) => void;
  onRotateStart: (
    cardId: string,
    centerX: number,
    centerY: number,
    pointerX: number,
    pointerY: number,
  ) => void;
  onResizeStart: (cardId: string, corner: 'se' | 'sw' | 'ne' | 'nw', x: number, y: number) => void;
  onDelete: (cardId: string) => void;
  onClick: (card: BoardCardData) => void;
}

function isEntryContent(
  content: BoardCardData['content'],
): content is { title: string; preview: string; createdAt: string } {
  return 'title' in content;
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
 * ズームしても見た目の大きさを保つための逆スケール。
 *
 * カードは world 空間にあるため transform でまるごと拡縮される。操作ハンドルや枠線まで
 * 一緒に拡縮すると、引いたときは豆粒で掴めず、寄ったときは巨大な塊になる。`--vp-scale`
 * （CanvasViewport が publish する現在の倍率）で割り戻すことで、再レンダリングなしに
 * 画面上の見かけの大きさを一定にする。キャンバスの外で単体表示されたときは fallback の
 * 1 が効くので、そのままの寸法で描かれる。
 */
const INVERSE_SCALE = 'scale(calc(1 / var(--vp-scale, 1)))';

/** 画面 px 固定のヘアライン。倍率によらず 1px / 1.5px に見せる。 */
function hairline(px: number): string {
  return `calc(${px}px / var(--vp-scale, 1))`;
}

export function BoardCard({
  card,
  detail = 'full',
  isSelected,
  isDragging,
  onPointerDown,
  onRotateStart,
  onResizeStart,
  onDelete,
  onClick,
}: BoardCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      onPointerDown(card.id, e.clientX, e.clientY);
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
      className="board-card"
      {...verifyAttrs({
        unit: 'BoardCard',
        cardType: card.cardType,
        detail,
        selected: isSelected,
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
    >
      {/* Invisible double-click target */}
      <button
        type="button"
        aria-label={
          card.cardType === 'entry'
            ? 'Open entry'
            : card.cardType === 'photo'
              ? 'View photo'
              : 'Edit snippet'
        }
        className="absolute inset-0 z-[1] cursor-grab bg-transparent"
        style={{ border: 'none', outline: 'none' }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onClick(card);
        }}
      />
      {/* 'block' では中身を描かない。引ききった状態では読めず、枚数分の
          テキスト描画がそのまま無駄になるため、色の付いた矩形だけにする。 */}
      {detail !== 'block' && card.cardType === 'entry' && isEntryContent(card.content) && (
        <EntryCardContent content={card.content} titleOnly={detail === 'title'} />
      )}
      {detail !== 'block' && card.cardType === 'snippet' && isSnippetContent(card.content) && (
        <SnippetCardContent content={card.content} titleOnly={detail === 'title'} />
      )}
      {detail !== 'block' && card.cardType === 'photo' && isPhotoContent(card.content) && (
        <PhotoCardContent content={card.content} />
      )}

      {/* Handles - visible only when selected */}
      {isSelected && (
        <>
          {/* Delete button */}
          <button
            type="button"
            aria-label="Delete card"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(card.id);
            }}
            className="absolute flex items-center justify-center rounded-full"
            style={{
              top: -8,
              right: -8,
              width: 22,
              height: 22,
              backgroundColor: 'var(--bg)',
              border: '1.5px solid rgba(200,80,80,0.5)',
              cursor: 'pointer',
              zIndex: 10,
              transform: INVERSE_SCALE,
            }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              stroke="rgba(200,80,80,0.7)"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <line x1="2" y1="2" x2="8" y2="8" />
              <line x1="8" y1="2" x2="2" y2="8" />
            </svg>
          </button>

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
              cursor: 'crosshair',
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

          {/* Resize handles */}
          {(['se', 'sw', 'nw'] as const).map((corner) => {
            const style: React.CSSProperties = {
              position: 'absolute',
              width: 18,
              height: 18,
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

            return <div key={corner} onPointerDown={handleResizeDown(corner)} style={style} />;
          })}
        </>
      )}
    </div>
  );
}
