'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useCallback, useRef, useState } from 'react';
import type { BoardCardData } from '@/features/shared/board/types';
import { toTransform, type Viewport } from '@/lib/canvas/viewport';

/** つかんでいる間だけ最前面へ。 */
const DRAGGING_Z = 1000;

/** 隅に小さく出す日付。`2026-09-04` → `09.04`。 */
export function formatCornerDate(dateKey: string): string {
  const [, month, day] = dateKey.split('-');
  return month && day ? `${month}.${day}` : dateKey;
}

/**
 * 画面上の移動量を world の移動量に直す。
 *
 * 盤面は縮小して表示しているので、指の移動をそのまま world に足すと縮小率のぶんだけ
 * カードが速く動き、指から離れていく。
 */
export function toWorldDelta(screenDelta: number, scale: number): number {
  if (!Number.isFinite(screenDelta) || !Number.isFinite(scale) || scale <= 0) return 0;
  return screenDelta / scale;
}

interface DragState {
  cardId: string;
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

export interface SpBoardSurfaceProps {
  cards: BoardCardData[];
  dateKey: string;
  /** 盤面を画面に収めるための変換。 */
  viewport: Viewport;
  /** 指の移動で新しい world 座標が決まったとき。 */
  onMove: (cardId: string, x: number, y: number) => void;
  /** 指を離したとき（保存はここで投げる）。 */
  onCommit: () => void;
}

/**
 * SP のボードの見た目と指の操作（`docs/oryzae-study/00-overview.md`「モバイル（SP）」）。
 *
 * **右ペインを置かない。** 縦画面で 400px の側パネルを出すと板がほぼ潰れる。日付と
 * カード枚数だけを隅に小さく浮かせ、**カードは指でつかんで動かせる**ようにする。
 * カードの重なりは指で解く前提なので、ズームもパンも与えない — 指の操作は
 * 「カードを動かす」1 つに絞る。
 *
 * データ取得と初期フィットは `sp-board.tsx` が持つ。ここは渡されたものを描くだけ。
 */
export function SpBoardSurface({
  cards,
  dateKey,
  viewport,
  onMove,
  onCommit,
}: SpBoardSurfaceProps) {
  const t = useTranslations('sp.board');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, card: BoardCardData) => {
      // 掴んだ指を最後まで追う。指が要素の外へ出ても pointermove が届く。
      event.currentTarget.setPointerCapture?.(event.pointerId);
      dragRef.current = {
        cardId: card.id,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: card.x,
        originY: card.y,
      };
      setDraggingId(card.id);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      onMove(
        drag.cardId,
        drag.originX + toWorldDelta(event.clientX - drag.startX, viewport.scale),
        drag.originY + toWorldDelta(event.clientY - drag.startY, viewport.scale),
      );
    },
    [onMove, viewport.scale],
  );

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      setDraggingId(null);
      onCommit();
    },
    [onCommit],
  );

  const visible = cards.filter((card) => !card.removing);

  return (
    <div
      {...verifyAttrs({
        unit: 'SpBoardSurface',
        cardCount: visible.length,
        dragging: draggingId !== null,
        dateKey,
        hasSidePane: false,
      })}
      className="relative h-full w-full overflow-hidden"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div
        className="absolute left-0 top-0"
        style={{ transform: toTransform(viewport), transformOrigin: '0 0' }}
      >
        {visible.map((card) => {
          const isDragging = draggingId === card.id;
          return (
            <div
              key={card.id}
              data-card-id={card.id}
              onPointerDown={(event) => handlePointerDown(event, card)}
              onPointerMove={handlePointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              style={{
                position: 'absolute',
                left: card.x,
                top: card.y,
                width: card.width,
                height: card.height,
                transform: `rotate(${card.rotation}deg)`,
                zIndex: isDragging ? DRAGGING_Z : card.zIndex,
                // 指の操作はカードの移動だけ。これが無いとブラウザのスクロールが先に走る。
                touchAction: 'none',
                borderRadius: 4,
                overflow: 'hidden',
                backgroundColor: card.cardType === 'photo' ? 'var(--bg)' : '#FBF7E8',
                border: '1px solid var(--border-subtle)',
                // つかんでいる間は影を深くして、板から浮いていることを見せる。
                boxShadow: isDragging
                  ? '0 12px 32px rgba(140,133,126,0.34)'
                  : '0 1px 4px rgba(140,133,126,0.14)',
                transition: isDragging ? 'none' : 'box-shadow 200ms ease',
              }}
            >
              <SpBoardCardContent card={card} />
            </div>
          );
        })}
      </div>

      {visible.length === 0 && (
        <p
          className="absolute inset-0 flex items-center justify-center px-8 text-center text-[13px]"
          style={{ color: 'var(--date-color)' }}
        >
          {t('empty')}
        </p>
      )}

      {/* 隅に日付と枚数だけ。右ペインの代わりはこれで足りる。 */}
      <div
        className="pointer-events-none absolute left-4 top-4 flex items-baseline gap-2"
        style={{ color: 'var(--date-color)', fontFamily: 'Inter, sans-serif' }}
      >
        <span className="text-[11px] tracking-[0.16em]">{formatCornerDate(dateKey)}</span>
        <span className="text-[10px] opacity-70">{t('cards', { count: visible.length })}</span>
      </div>
    </div>
  );
}

/**
 * カードの中身。PC の意味的ズーム（引いたら中身を落とす）は持たない。
 *
 * SP は盤面を一度フィットさせたきり倍率が変わらないので、出し分ける段階が無い。
 */
function SpBoardCardContent({ card }: { card: BoardCardData }) {
  if (card.cardType === 'photo' && 'imageUrl' in card.content) {
    return (
      // biome-ignore lint/performance/noImgElement: Supabase storage の署名付き URL
      <img
        src={card.content.imageUrl}
        alt={card.content.caption || ''}
        // 掴んだ瞬間にネイティブの画像ドラッグが始まるとカードを動かせなくなる。
        draggable={false}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    );
  }
  if ('text' in card.content) {
    return (
      // 盤面は縮小して全体を映すので、カードの中の文字は**縮尺のぶん割り増して**おかないと
      // 実機で読めない（12px は板の縮尺が乗ると 6〜7px 相当になる）。
      <p
        className="h-full overflow-hidden whitespace-pre-wrap p-2.5 text-[17px]"
        style={{ color: 'var(--fg)', lineHeight: 1.6 }}
      >
        {card.content.text}
      </p>
    );
  }
  return null;
}
