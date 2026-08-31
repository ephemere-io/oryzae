'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useCallback, useRef } from 'react';
import type { BoardCardData } from '@/features/shared/board/types';
import { EntryCardContent } from './entry-card-content';
import { PhotoCardContent } from './photo-card-content';
import { SnippetCardContent } from './snippet-card-content';

interface BoardCardProps {
  card: BoardCardData;
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
  /** カード上で本文を編集中か。編集中はドラッグせず、文字を選べるようにする。 */
  isEditing?: boolean;
  /** 編集中に表示・更新する本文（全文）。 */
  editValue?: string;
  onEditChange?: (next: string) => void;
  editLoading?: boolean;
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

export function BoardCard({
  card,
  isSelected,
  isDragging,
  onPointerDown,
  onRotateStart,
  onResizeStart,
  onDelete,
  onClick,
  isEditing = false,
  editValue = '',
  onEditChange,
  editLoading = false,
}: BoardCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      // 編集中はドラッグを始めない。始めてしまうと、本文を選ぼうとしただけで
      // カードが動き、文字も選べない（pointerdown を握ったままになるため）。
      if (isEditing) return;
      onPointerDown(card.id, e.clientX, e.clientY);
    },
    [card.id, onPointerDown, isEditing],
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
        selected: isSelected,
        editing: isEditing,
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
        cursor: isEditing ? 'default' : isDragging ? 'grabbing' : 'grab',
        borderRadius: 2,
        backgroundColor:
          card.cardType === 'snippet'
            ? 'var(--card-snippet, #FFFBE0)'
            : card.cardType === 'photo'
              ? 'var(--card-photo, #ffffff)'
              : 'var(--bg)',
        border: '1px solid var(--border-subtle)',
        boxShadow: isDragging
          ? '0 20px 40px rgba(0,0,0,0.15)'
          : '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.03)',
        outline: isSelected ? '1.5px solid rgba(74,158,142,0.5)' : 'none',
        outlineOffset: isSelected ? 4 : 0,
        overflow: isSelected ? 'visible' : 'hidden',
        // 編集中だけ文字を選べるようにする。常に選べると、掴んで動かそうとした
        // だけで選択が始まってカードが動かせない。
        userSelect: isEditing ? 'text' : 'none',
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
        if (isEditing) return;
        onClick(card);
      }}
    >
      {/* 全面を覆う透明ボタンは置かない。以前はダブルクリックの的として敷いていたが、
          それがカードの文字を一切選べなくしていた（コピーもできなかった）。
          ダブルクリックはカード本体で受ける。 */}
      {card.cardType === 'entry' && isEntryContent(card.content) && (
        <EntryCardContent
          content={card.content}
          editing={isEditing}
          editValue={editValue}
          onEditChange={onEditChange}
          editLoading={editLoading}
        />
      )}
      {card.cardType === 'snippet' && isSnippetContent(card.content) && (
        <SnippetCardContent content={card.content} />
      )}
      {card.cardType === 'photo' && isPhotoContent(card.content) && (
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
              transform: 'translateX(-50%)',
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
