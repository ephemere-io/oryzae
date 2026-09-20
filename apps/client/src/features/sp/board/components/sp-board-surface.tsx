'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useCallback, useRef, useState } from 'react';
import { CanvasMinimap } from '@/components/ui/canvas-minimap';
import { CanvasViewport } from '@/components/ui/canvas-viewport';
import { snippetFontSize } from '@/features/shared/board/card-text';
import type { BoardCardData } from '@/features/shared/board/types';
import type { CanvasSurface } from '@/lib/canvas/use-canvas-viewport';

/** つかんでいる間だけ最前面へ。 */
const DRAGGING_Z = 1000;

/** これ以上動いたら「動かした」。それ未満なら「選んだ」（画面 px）。 */
const TAP_SLOP = 6;

/** 角のつまみの大きさ（画面上の px）。指で掴める最小限。 */
const HANDLE_SIZE = 28;

/** カードをこれより小さくしない（掴めなくなる）。 */
const MIN_CARD_SIZE = 60;

/**
 * SP の本文の基準の大きさ。盤面を縮めて映すぶん、PC（14px）より大きく取る。
 * カードの幅に追随する（`snippetFontSize`）。
 */
const SP_BASE_FONT_SIZE = 17;

/**
 * 画面 px で一定に見せたい寸法（枠線・つまみ）。
 *
 * world に置いた要素は盤面ごと拡縮されるので、`--vp-scale`（CanvasViewport が毎フレーム
 * publish する倍率）で割り戻す。**CSS で割るので再描画が要らない** — ピンチの最中でも
 * 枠の太さとつまみの大きさが指に対して一定に保たれる。
 */
function inverseScale(px: number): string {
  return `calc(${px}px / var(--vp-scale, 1))`;
}

/**
 * カードの中心から指までの向きと距離から、回転角と大きさを出す。
 *
 * 角のつまみ 1 つで**回転と拡大縮小を同時に**扱う。SP に 2 種類のつまみを並べると、
 * どちらも指より小さくなって掴み分けられない。掴んだ瞬間の向き・距離を基準にして、
 * そこからの差分を角度と倍率にする。
 *
 * 向きも距離も **world 座標で測る**。画面 px で測っていたころは、つまみの
 * `offsetParent` から中心を逆算していたため、盤面を包む層が増えると基準がずれて
 * 「広げているのに縮む」ことがあった。world なら倍率もパンも関係しない。
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
  /** タップか移動かは**画面 px**で判定する（倍率で過敏・鈍感にならないように）。 */
  startClientX: number;
  startClientY: number;
  /** 位置の計算は world で行う。 */
  startWorldX: number;
  startWorldY: number;
  originX: number;
  originY: number;
  moved: number;
}

interface ResizeState {
  cardId: string;
  pointerId: number;
  /** 掴んだ瞬間の、カード中心から指への向きと距離（world）。 */
  startAngle: number;
  startDistance: number;
  startRotation: number;
  startWidth: number;
  startHeight: number;
}

export interface SpBoardSurfaceProps {
  cards: BoardCardData[];
  /** パン・ピンチを持つ盤面（PC のボードと同じ `useCanvasViewport`）。 */
  canvas: CanvasSurface;
  /** 指の移動で新しい world 座標が決まったとき。 */
  onMove: (cardId: string, x: number, y: number) => void;
  /** 指を離したとき（保存はここで投げる）。 */
  onCommit: () => void;
  /** 選んでいるカード。`null` なら何も選んでいない。 */
  selectedId?: string | null;
  onSelect?: (cardId: string | null) => void;
  /**
   * タップしたカードを前面へ。
   *
   * 重なった板では、下のカードに触れても埋もれたままだと読めない（実機レビュー指摘）。
   * 選ぶのと同時に手前へ出す。
   */
  onRaise?: (cardId: string) => void;
  /** 角のつまみで回転と大きさが決まったとき。 */
  onTransform?: (cardId: string, next: { rotation: number; width: number; height: number }) => void;
}

/**
 * SP のボードの見た目と指の操作。
 *
 * **右ペインを置かない。** 縦画面で 400px の側パネルを出すと板がほぼ潰れる。
 * カード枚数だけを隅に小さく浮かせる。
 *
 * 指の割り当ては PC のボードと同じ `CanvasViewport` に委ねる:
 * **カードの上の 1 本指はそのカードを動かす**（`data-canvas-no-pan`）、
 * **空きの 1 本指は盤面を動かす**、**2 本指は寄り引き**。盤面が `touch-action: none` を
 * 持つので、ピンチがブラウザのページズーム（iOS のタブ一覧）に奪われることもない。
 *
 * データ取得と初期の寄せ方は `sp-board.tsx` が持つ。ここは渡されたものを描くだけ。
 */
export function SpBoardSurface({
  cards,
  canvas,
  onMove,
  onCommit,
  selectedId = null,
  onSelect,
  onRaise,
  onTransform,
}: SpBoardSurfaceProps) {
  const t = useTranslations('sp.board');
  const tBoard = useTranslations('board');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, card: BoardCardData) => {
      // 掴んだ指を最後まで追う。指が要素の外へ出ても pointermove が届く。
      event.currentTarget.setPointerCapture?.(event.pointerId);
      const world = canvas.toWorld(event.clientX, event.clientY);
      dragRef.current = {
        cardId: card.id,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startWorldX: world.x,
        startWorldY: world.y,
        originX: card.x,
        originY: card.y,
        moved: 0,
      };
      setDraggingId(card.id);
    },
    [canvas],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      drag.moved =
        Math.abs(event.clientX - drag.startClientX) + Math.abs(event.clientY - drag.startClientY);
      // 触れただけでは動かさない。指はわずかに揺れるので、選ぶつもりの操作で
      // カードが 1〜2px ずれて保存されてしまう。
      if (drag.moved < TAP_SLOP) return;
      const world = canvas.toWorld(event.clientX, event.clientY);
      onMove(
        drag.cardId,
        drag.originX + (world.x - drag.startWorldX),
        drag.originY + (world.y - drag.startWorldY),
      );
    },
    [canvas, onMove],
  );

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      setDraggingId(null);
      // 動かしていなければ「選んだ」＝前面へ出す。動かしたなら位置を保存する。
      if (drag.moved < TAP_SLOP) {
        onSelect?.(drag.cardId);
        onRaise?.(drag.cardId);
      } else {
        onCommit();
      }
    },
    [onCommit, onSelect, onRaise],
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

  /** 角のつまみ。中心から指への向きと距離（world）で、回転と大きさを同時に決める。 */
  const handleResizeMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const resize = resizeRef.current;
      if (!resize || resize.pointerId !== event.pointerId || !onTransform) return;
      const card = cards.find((candidate) => candidate.id === resize.cardId);
      if (!card) return;

      const pointer = canvas.toWorld(event.clientX, event.clientY);
      const dx = pointer.x - (card.x + card.width / 2);
      const dy = pointer.y - (card.y + card.height / 2);

      onTransform(
        resize.cardId,
        resizeFromHandle({
          startAngle: resize.startAngle,
          startDistance: resize.startDistance,
          angle: Math.atan2(dy, dx),
          distance: Math.hypot(dx, dy),
          startRotation: resize.startRotation,
          startWidth: resize.startWidth,
          startHeight: resize.startHeight,
        }),
      );
    },
    [canvas, cards, onTransform],
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
      className="relative h-full w-full"
    >
      <CanvasViewport
        canvas={canvas}
        ariaLabel={tBoard('canvas.aria_label')}
        style={{ backgroundColor: 'var(--bg)' }}
        // 板の何も無いところを押したら選択を解く（PC の盤面と同じ）。
        onClick={() => onSelect?.(null)}
        overlay={
          <>
            {visible.length === 0 && (
              <p
                className="pointer-events-none absolute inset-0 flex items-center justify-center px-8 text-center text-[13px]"
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
              <span className="text-[10px] opacity-70">
                {t('cards', { count: visible.length })}
              </span>
            </div>
            {/* 俯瞰（PC の盤面と同じ部品）。寄って動き回れるようになった代わりに、
                いま板のどこに居るのかが分からなくなった（実機レビュー: 「全体マップが
                なくなった。中央から離れると迷子になりそう」）。 */}
            {visible.length > 0 && (
              <CanvasMinimap
                canvas={canvas}
                ariaLabel={tBoard('minimap.aria_label')}
                items={visible.map((card) => ({
                  id: card.id,
                  x: card.x,
                  y: card.y,
                  width: card.width,
                  height: card.height,
                }))}
              />
            )}
          </>
        }
      >
        {visible.map((card) => {
          const isDragging = draggingId === card.id;
          return (
            <div
              key={card.id}
              data-card-id={card.id}
              // 掴んだらカードを動かす（盤面のパンを始めない）。
              data-canvas-no-pan=""
              onPointerDown={(event) => handlePointerDown(event, card)}
              onPointerMove={handlePointerMove}
              onPointerUp={endDrag}
              onPointerCancel={cancelDrag}
              // 盤面の「空きを押したら選択解除」まで伝播させない。
              onClick={(event) => event.stopPropagation()}
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
                border: `${inverseScale(1)} solid var(--border-subtle)`,
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
                    border: `${inverseScale(1.5)} solid var(--accent)`,
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
                data-canvas-no-pan=""
                onPointerDown={(event) => {
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture?.(event.pointerId);
                  const pointer = canvas.toWorld(event.clientX, event.clientY);
                  const dx = pointer.x - (card.x + card.width / 2);
                  const dy = pointer.y - (card.y + card.height / 2);
                  resizeRef.current = {
                    cardId: card.id,
                    pointerId: event.pointerId,
                    startAngle: Math.atan2(dy, dx),
                    startDistance: Math.hypot(dx, dy),
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
                  width: inverseScale(HANDLE_SIZE),
                  height: inverseScale(HANDLE_SIZE),
                  marginLeft: inverseScale(-HANDLE_SIZE / 2),
                  marginTop: inverseScale(-HANDLE_SIZE / 2),
                  transformOrigin: `${-card.width / 2}px ${-card.height / 2}px`,
                  transform: `rotate(${card.rotation}deg)`,
                  zIndex: DRAGGING_Z + 1,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  border: `${inverseScale(2)} solid #fff`,
                  boxShadow: '0 2px 8px rgba(140,133,126,0.3)',
                  touchAction: 'none',
                }}
              />
            ))}
      </CanvasViewport>
    </div>
  );
}

/**
 * カードの中身。PC の意味的ズーム（引いたら中身を落とす）は持たない。
 *
 * 文字の大きさはカードの幅に追随する（`snippetFontSize`）。固定サイズだと、盤面を
 * 引いたときに本文だけが先に潰れて読めなくなる。
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
      <p
        className="h-full overflow-hidden whitespace-pre-wrap p-2.5"
        style={{
          color: 'var(--fg)',
          lineHeight: 1.6,
          fontSize: snippetFontSize(card.width, SP_BASE_FONT_SIZE),
        }}
      >
        {card.content.text}
      </p>
    );
  }
  return null;
}
