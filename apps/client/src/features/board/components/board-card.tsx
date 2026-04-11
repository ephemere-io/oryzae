'use client';

import { useCallback, useRef } from 'react';
import type { BoardCardData } from '../hooks/use-board';
import { EntryCardContent } from './entry-card-content';
import { PhotoCardContent } from './photo-card-content';
import { SnippetCardContent } from './snippet-card-content';

interface BoardCardProps {
  card: BoardCardData;
  isSelected: boolean;
  isDragging: boolean;
  onPointerDown: (cardId: string, x: number, y: number) => void;
  onRotateStart: (cardId: string, centerX: number, centerY: number) => void;
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

export function BoardCard({
  card,
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
      onRotateStart(card.id, rect.left + rect.width / 2, rect.top + rect.height / 2);
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
        backgroundColor: card.cardType === 'snippet' ? 'var(--card-snippet, #FFFBE0)' : 'var(--bg)',
        border: '1px solid var(--border-subtle)',
        boxShadow: isDragging
          ? '0 20px 40px rgba(0,0,0,0.15)'
          : '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.03)',
        outline: isSelected ? '1.5px solid rgba(74,158,142,0.5)' : 'none',
        outlineOffset: isSelected ? 4 : 0,
        overflow: 'hidden',
        userSelect: 'none',
        touchAction: 'none',
        animation: card.removing
          ? 'itemRemove 0.28s ease forwards'
          : 'popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        pointerEvents: card.removing ? 'none' : 'auto',
        transition: 'box-shadow 0.2s ease',
      }}
      onPointerDown={handlePointerDown}
    >
      {/* Invisible click target */}
      <button
        type="button"
        aria-label={card.cardType === 'entry' ? 'Open entry' : 'Edit snippet'}
        className="absolute inset-0 z-[1] cursor-grab bg-transparent"
        style={{ border: 'none', outline: 'none' }}
        onClick={(e) => {
          e.stopPropagation();
          onClick(card);
        }}
      />
      {card.cardType === 'entry' && isEntryContent(card.content) && (
        <EntryCardContent content={card.content} />
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
              bottom: -32,
              transform: 'translateX(-50%)',
              width: 24,
              height: 24,
              backgroundColor: 'var(--bg)',
              border: '1.5px solid var(--accent)',
              opacity: 0.8,
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
          {(['se', 'sw', 'ne', 'nw'] as const).map((corner) => {
            const style: React.CSSProperties = {
              position: 'absolute',
              width: 10,
              height: 10,
              backgroundColor: 'var(--bg)',
              border: '1px solid var(--accent)',
              zIndex: 10,
            };
            if (corner.includes('s')) style.bottom = -6;
            if (corner.includes('n')) style.top = -6;
            if (corner.includes('e')) style.right = -6;
            if (corner.includes('w')) style.left = -6;
            style.cursor = `${corner}-resize`;

            return <div key={corner} onPointerDown={handleResizeDown(corner)} style={style} />;
          })}
        </>
      )}
    </div>
  );
}
