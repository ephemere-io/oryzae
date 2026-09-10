'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useCallback, useRef, useState } from 'react';
import type { BoardCardData } from '@/features/shared/board/types';
import { toTransform, type Viewport, worldToScreen } from '@/lib/canvas/viewport';

/** つかんでいる間だけ最前面へ。 */
const DRAGGING_Z = 1000;

/** これ以上動いたら「動かした」。それ未満なら「選んだ」。 */
const TAP_SLOP = 6;

/** 角のつまみの大きさ（画面上の px）。指で掴める最小限。 */
const HANDLE_SIZE = 28;

/** カードをこれより小さくしない（掴めなくなる）。 */
const MIN_CARD_SIZE = 60;

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

/**
 * カードの中心から指までの向きと距離から、回転角と大きさを出す。
 *
 * 角のつまみ 1 つで**回転と拡大縮小を同時に**扱う。SP に 2 種類のつまみを並べると、
 * どちらも指より小さくなって掴み分けられない。掴んだ瞬間の向き・距離を基準にして、
 * そこからの差分を角度と倍率にする。
 */
export function resizeFromHandle(options: {
  /** 掴んだ瞬間の、中心から指への向き（rad）と距離（world）。 */
  startAngle: number;
  startDistance: number;
  /** いまの向きと距離。 */
  angle: number;
  distance: number;
  /** 掴んだ瞬間のカードの回転（deg）と大きさ（world）。 */
  startRotation: number;
  startWidth: number;
  startHeight: number;
}): { rotation: number; width: number; height: number } {
  const { startAngle, startDistance, angle, distance } = options;
  const ratio = startDistance > 0 ? distance / startDistance : 1;
  // 縦横の比は変えない。SP では片方だけ伸ばす操作は要求されておらず、比が崩れると
  // 写真が引き伸ばされて元に戻せない。
  const width = Math.max(MIN_CARD_SIZE, options.startWidth * ratio);
  const height = Math.max(MIN_CARD_SIZE, options.startHeight * ratio);
  const turned = ((angle - startAngle) * 180) / Math.PI;
  return { rotation: normalizeDegrees(options.startRotation + turned), width, height };
}

/** -180..180 に畳む。値が無限に増えると保存した数字が読めなくなる。 */
export function normalizeDegrees(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  const wrapped = ((((deg + 180) % 360) + 360) % 360) - 180;
  return Math.round(wrapped * 10) / 10;
}

interface DragState {
  cardId: string;
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  /** 指が動いた総量（px）。これが小さいまま離したら「選んだ」。 */
  moved: number;
}

interface ResizeState {
  cardId: string;
  pointerId: number;
  /** 掴んだ瞬間の、カード中心から指への向きと距離。 */
  startAngle: number;
  startDistance: number;
  startRotation: number;
  startWidth: number;
  startHeight: number;
}

export interface SpBoardSurfaceProps {
  cards: BoardCardData[];
  /** 盤面を画面に収めるための変換。 */
  viewport: Viewport;
  /** 指の移動で新しい world 座標が決まったとき。 */
  onMove: (cardId: string, x: number, y: number) => void;
  /** 指を離したとき（保存はここで投げる）。 */
  onCommit: () => void;
  /** 選んでいるカード。`null` なら何も選んでいない。 */
  selectedId?: string | null;
  onSelect?: (cardId: string | null) => void;
  /** 角のつまみで回転と大きさが決まったとき。 */
  onTransform?: (cardId: string, next: { rotation: number; width: number; height: number }) => void;
}

/**
 * SP のボードの見た目と指の操作（`docs/oryzae-study/00-overview.md`「モバイル（SP）」）。
 *
 * **右ペインを置かない。** 縦画面で 400px の側パネルを出すと板がほぼ潰れる。
 * カード枚数だけを隅に小さく浮かせ、**カードは指でつかんで動かせる**ようにする。
 * カードの重なりは指で解く前提なので、ズームもパンも与えない — 指の操作は
 * 「カードを動かす」1 つに絞る。
 *
 * データ取得と初期フィットは `sp-board.tsx` が持つ。ここは渡されたものを描くだけ。
 */
export function SpBoardSurface({
  cards,
  viewport,
  onMove,
  onCommit,
  selectedId = null,
  onSelect,
  onTransform,
}: SpBoardSurfaceProps) {
  const t = useTranslations('sp.board');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);

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
        moved: 0,
      };
      setDraggingId(card.id);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      drag.moved = Math.abs(dx) + Math.abs(dy);
      // 触れただけでは動かさない。指はわずかに揺れるので、選ぶつもりの操作で
      // カードが 1〜2px ずれて保存されてしまう。
      if (drag.moved < TAP_SLOP) return;
      onMove(
        drag.cardId,
        drag.originX + toWorldDelta(dx, viewport.scale),
        drag.originY + toWorldDelta(dy, viewport.scale),
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
      // 動かしていなければ「選んだ」。動かしたなら位置を保存する。
      if (drag.moved < TAP_SLOP) onSelect?.(drag.cardId);
      else onCommit();
    },
    [onCommit, onSelect],
  );

  /**
   * 指が横取りされたとき（pointercancel）。
   *
   * 「選んだ」とは扱わない — 利用者が離したわけではないので、選択が勝手に変わると
   * 押した覚えのないカードの操作が道具箱に出る。動かしていたぶんは画面に残っているので、
   * そこだけ保存して掴みを解く。
   */
  const cancelDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      setDraggingId(null);
      if (drag.moved >= TAP_SLOP) onCommit();
    },
    [onCommit],
  );

  /** 角のつまみ。中心から指への向きと距離で、回転と大きさを同時に決める。 */
  const handleResizeMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const resize = resizeRef.current;
      if (!resize || resize.pointerId !== event.pointerId || !onTransform) return;
      const card = cards.find((candidate) => candidate.id === resize.cardId);
      if (!card) return;

      const center = cardCenterOnScreen(event.currentTarget, card, viewport);
      if (!center) return;
      const dx = event.clientX - center.x;
      const dy = event.clientY - center.y;

      onTransform(
        resize.cardId,
        resizeFromHandle({
          startAngle: resize.startAngle,
          startDistance: resize.startDistance,
          angle: Math.atan2(dy, dx),
          distance: toWorldDelta(Math.hypot(dx, dy), viewport.scale),
          startRotation: resize.startRotation,
          startWidth: resize.startWidth,
          startHeight: resize.startHeight,
        }),
      );
    },
    [cards, onTransform, viewport],
  );

  const endResize = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const resize = resizeRef.current;
      if (!resize || resize.pointerId !== event.pointerId) return;
      resizeRef.current = null;
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
        hasSidePane: false,
        selectedId: selectedId ?? 'none',
      })}
      className="relative h-full w-full overflow-hidden"
      style={{ backgroundColor: 'var(--bg)' }}
      // 板の何も無いところを押したら選択を解く（PC の盤面と同じ）。
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onSelect?.(null);
      }}
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
              onPointerCancel={cancelDrag}
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

              {/* 選んでいる印。枠は**逆スケール**して、盤面の倍率によらず一定の太さにする。 */}
              {selectedId === card.id && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                  style={{
                    border: `${1.5 / viewport.scale}px solid var(--accent)`,
                    borderRadius: 4,
                  }}
                />
              )}
            </div>
          );
        })}

        {/* 角のつまみ。カードの外（右下）に浮かせる。カードの中に置くと本文に重なる。 */}
        {onTransform &&
          visible
            .filter((card) => card.id === selectedId)
            .map((card) => (
              <button
                key={`handle-${card.id}`}
                type="button"
                aria-label={t('resize')}
                data-testid="sp-board-handle"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture?.(event.pointerId);
                  const center = cardCenterOnScreen(event.currentTarget, card, viewport);
                  if (!center) return;
                  const dx = event.clientX - center.x;
                  const dy = event.clientY - center.y;
                  resizeRef.current = {
                    cardId: card.id,
                    pointerId: event.pointerId,
                    startAngle: Math.atan2(dy, dx),
                    startDistance: toWorldDelta(Math.hypot(dx, dy), viewport.scale),
                    startRotation: card.rotation,
                    startWidth: card.width,
                    startHeight: card.height,
                  };
                }}
                onPointerMove={handleResizeMove}
                onPointerUp={endResize}
                onPointerCancel={endResize}
                style={{
                  position: 'absolute',
                  // カードは回転しているので、つまみも同じ回転の右下に置く。
                  left: card.x + card.width,
                  top: card.y + card.height,
                  // 逆スケール。盤面を縮めても指で掴める大きさを保つ。
                  width: HANDLE_SIZE / viewport.scale,
                  height: HANDLE_SIZE / viewport.scale,
                  marginLeft: -HANDLE_SIZE / viewport.scale / 2,
                  marginTop: -HANDLE_SIZE / viewport.scale / 2,
                  transformOrigin: `${-card.width / 2}px ${-card.height / 2}px`,
                  transform: `rotate(${card.rotation}deg)`,
                  zIndex: DRAGGING_Z + 1,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  border: `${2 / viewport.scale}px solid #fff`,
                  boxShadow: '0 2px 8px rgba(140,133,126,0.3)',
                  touchAction: 'none',
                }}
              />
            ))}
      </div>

      {visible.length === 0 && (
        <p
          className="absolute inset-0 flex items-center justify-center px-8 text-center text-[13px]"
          style={{ color: 'var(--date-color)' }}
        >
          {t('nothing_pinned')}
        </p>
      )}

      {/* 隅に枚数だけ。右ペインの代わりはこれで足りる。 */}
      <div
        className="pointer-events-none absolute top-4 flex items-baseline gap-2"
        style={{
          // 書斎が有効な間は左上に「書斎へ戻る」マークが浮く。避けないと枚数に重なる。
          left: '1rem',
          color: 'var(--date-color)',
          fontFamily: 'Inter, sans-serif',
        }}
      >
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

/**
 * カードの中心の**画面座標**。つまみの向きと距離を測る基準。
 *
 * つまみ自身の位置から逆算する（カードの DOM を探しに行かない）。つまみはカードの
 * 右下角に、カードと同じ回転で置いてあるので、そこからカードの中心が決まる。
 */
function cardCenterOnScreen(
  handle: HTMLElement,
  card: BoardCardData,
  viewport: Viewport,
): { x: number; y: number } | null {
  const frame = handle.offsetParent;
  if (!(frame instanceof HTMLElement)) return null;
  const rect = frame.getBoundingClientRect();
  const center = worldToScreen(viewport, card.x + card.width / 2, card.y + card.height / 2);
  return { x: rect.left + center.x, y: rect.top + center.y };
}
