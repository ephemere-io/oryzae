'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CanvasGrid } from '@/components/ui/canvas-grid';
import { CanvasMinimap } from '@/components/ui/canvas-minimap';
import { CanvasViewport } from '@/components/ui/canvas-viewport';
import { CanvasZoomControls } from '@/components/ui/canvas-zoom-controls';
import { ErrorState } from '@/components/ui/error-state';
import { PageLoading } from '@/components/ui/page-loading';
import { useBoard } from '@/features/shared/board/hooks/use-board';
import { useBoardSave } from '@/features/shared/board/hooks/use-board-save';
import type { BoardCardData } from '@/features/shared/board/types';
import type { ApiClient } from '@/lib/api';
import { useCanvasViewport } from '@/lib/canvas/use-canvas-viewport';
import { type Bounds, unionBounds } from '@/lib/canvas/viewport';
import { useBoardInteraction } from '../hooks/use-board-interaction';
import {
  BoardCard,
  type CardDetail,
  DETAIL_THRESHOLD_FULL,
  DETAIL_THRESHOLD_TITLE,
} from './board-card';
import { BoardControls } from './board-controls';
import { BoardDateNav } from './board-date-nav';

import { PhotoDialog } from './photo-dialog';
import { SnippetDialog } from './snippet-dialog';

interface BoardViewProps {
  api: ApiClient;
}

/**
 * 意味的ズームのしきい値。
 *
 * これより引いたら中身を落とす。倍率が下がるほど1枚あたりの文字は読めなくなる一方、
 * 描画コストは変わらないので、読めなくなった時点で描くのをやめる。
 *
 * **「まだ読める倍率で消さない」ことを優先する。** 以前は 75% 未満で本文を落として
 * いたが、75% はまだ十分読めるうえ、スニペットは本文が唯一の中身なので空カードに
 * 見えてしまった（PR #533 のレビュー指摘）。本文が実際に潰れ始める辺りまで下げる。
 */
// 閾値の実体は board-card 側にある。カード内の重ね合わせ（文字↔図のすれ違い）が
// 同じ値を見ており、ここで別に持つとずれた瞬間に段差が出る。

/**
 * 新規カードの既定サイズ（world 単位）。中心合わせの計算にだけ使う。
 * 実サイズはサーバーが決める（スニペットは 262×120、写真は画像比から算出）ので、
 * ここは「だいたい中心」に置くための目安。
 */
const NEW_SNIPPET_WIDTH = 262;
const NEW_SNIPPET_HEIGHT = 120;
const NEW_PHOTO_SIZE = 220;

function detailForScale(scale: number): CardDetail {
  if (scale < DETAIL_THRESHOLD_TITLE) return 'block';
  if (scale < DETAIL_THRESHOLD_FULL) return 'title';
  return 'full';
}

/** カード1枚の world 矩形。全体表示・ミニマップ・選択ズームで共通に使う。 */
function cardBounds(card: BoardCardData): Bounds {
  return { x: card.x, y: card.y, width: card.width, height: card.height };
}

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function BoardView({ api }: BoardViewProps) {
  const t = useTranslations('board');
  const router = useRouter();
  const [dateKey, setDateKey] = useState(todayKey);
  const [viewType, setViewType] = useState<'daily' | 'weekly'>('daily');
  const [snippetDialog, setSnippetDialog] = useState<{
    open: boolean;
    snippetId?: string;
    initialText?: string;
  }>({ open: false });

  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ imageUrl: string; caption: string } | null>(null);

  const {
    cards,
    setCards,
    loading,
    error,
    refresh,
    createSnippet,
    updateSnippet,
    createPhoto,
    deleteCard,
  } = useBoard(api, dateKey, viewType);
  const { savePositions } = useBoardSave(api);

  // ショートカット（Shift+1/2）から最新のカード・選択を読むための箱。
  // hook 側は ref 越しに呼ぶので、ここで毎レンダー新しい関数を渡してよい。
  const cardsRef = useRef<BoardCardData[]>([]);
  const selectedIdRef = useRef<string | null>(null);

  const canvas = useCanvasViewport({
    storageKey: 'board',
    getContentBounds: () =>
      unionBounds(cardsRef.current.filter((c) => !c.removing).map(cardBounds)),
    getSelectionBounds: () => {
      const selected = cardsRef.current.find((c) => c.id === selectedIdRef.current);
      return selected ? cardBounds(selected) : null;
    },
  });
  const { toWorld, centerWorld, zoomIn, zoomOut, resetZoom, fitTo } = canvas;
  const scale = canvas.viewport.scale;
  const detail = detailForScale(scale);

  const [showLoader, setShowLoader] = useState(false);
  useEffect(() => {
    if (!loading) {
      setShowLoader(false);
      return;
    }
    const timer = setTimeout(() => setShowLoader(true), 250);
    return () => clearTimeout(timer);
  }, [loading]);

  const handleCardsChange = useCallback(
    (newCards: BoardCardData[]) => {
      setCards(newCards);
    },
    [setCards],
  );

  const handleInteractionEnd = useCallback(() => {
    savePositions(cards);
  }, [cards, savePositions]);

  const {
    selectedId,
    draggingId,
    startDrag,
    startRotate,
    startResize,
    onPointerMove,
    onPointerUp,
    deselect,
    didDrag,
  } = useBoardInteraction(cards, handleCardsChange, handleInteractionEnd, scale);

  cardsRef.current = cards;
  selectedIdRef.current = selectedId;

  // ── ポインタ座標の world 変換 ───────────────────────────────────
  // カードは clientX/Y を上げてくるので、ここで world に直してから hook に渡す。
  // これで useBoardInteraction は倍率を知らずに済む（回転は中心・ポインタとも world に
  // そろえる。等方スケールなので角度は変わらない）。
  const handleCardPointerDown = useCallback(
    (cardId: string, clientX: number, clientY: number) => {
      const p = toWorld(clientX, clientY);
      startDrag(cardId, p.x, p.y);
    },
    [toWorld, startDrag],
  );

  const handleRotateStart = useCallback(
    (cardId: string, centerX: number, centerY: number, pointerX: number, pointerY: number) => {
      const center = toWorld(centerX, centerY);
      const pointer = toWorld(pointerX, pointerY);
      startRotate(cardId, center.x, center.y, pointer.x, pointer.y);
    },
    [toWorld, startRotate],
  );

  const handleResizeStart = useCallback(
    (cardId: string, corner: 'se' | 'sw' | 'ne' | 'nw', clientX: number, clientY: number) => {
      const p = toWorld(clientX, clientY);
      startResize(cardId, corner, p.x, p.y);
    },
    [toWorld, startResize],
  );

  const handleFramePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const p = toWorld(e.clientX, e.clientY);
      onPointerMove(p.x, p.y);
    },
    [toWorld, onPointerMove],
  );

  /**
   * 新規カードを置く world 座標。
   *
   * 「いま見えている場所」に出す。サーバー既定の固定範囲ランダムだと、遠くへパンした
   * 状態で作ったカードが画面外に生まれて「押したのに何も起きない」ように見える。
   * カードの左上を指定するので、中心に来るよう既定サイズの半分だけずらす。
   */
  const placementForNewCard = useCallback(
    (width: number, height: number) => {
      const center = centerWorld();
      return { x: Math.round(center.x - width / 2), y: Math.round(center.y - height / 2) };
    },
    [centerWorld],
  );

  const handleFit = useCallback(() => {
    fitTo(unionBounds(cards.filter((c) => !c.removing).map(cardBounds)));
  }, [cards, fitTo]);

  const handleCardClick = useCallback(
    (card: BoardCardData) => {
      if (didDrag()) return;
      if (card.cardType === 'entry') {
        router.push(`/entries/${card.refId}`);
      } else if (card.cardType === 'snippet' && 'text' in card.content) {
        setSnippetDialog({ open: true, snippetId: card.refId, initialText: card.content.text });
      } else if (card.cardType === 'photo' && 'imageUrl' in card.content) {
        setLightbox({ imageUrl: card.content.imageUrl, caption: card.content.caption });
      }
    },
    [router, didDrag],
  );

  const handleDeleteCard = useCallback(
    (cardId: string) => {
      const card = cards.find((c) => c.id === cardId);
      if (!card) return;
      deleteCard(cardId, card.cardType, card.refId);
    },
    [cards, deleteCard],
  );

  // Keyboard handling for Delete/Backspace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // @type-assertion-allowed: DOM KeyboardEvent target is always HTMLElement
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        // @type-assertion-allowed: DOM KeyboardEvent target is always HTMLElement
        if ((e.target as HTMLElement).isContentEditable) return;
        if (selectedId) {
          e.preventDefault();
          handleDeleteCard(selectedId);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, handleDeleteCard]);

  const visibleCardCount = cards.filter((c) => !c.removing).length;

  return (
    <div
      {...verifyAttrs({
        unit: 'BoardView',
        viewType,
        snippetOpen: snippetDialog.open,
        photoOpen: photoDialogOpen,
        percent: Math.round(scale * 100),
        detail,
      })}
      className="relative h-full w-full"
    >
      <CanvasViewport
        canvas={canvas}
        ariaLabel={t('canvas.aria_label')}
        style={{ backgroundColor: 'var(--bg)' }}
        onPointerMove={handleFramePointerMove}
        onPointerUp={onPointerUp}
        onClick={deselect}
        background={<CanvasGrid canvas={canvas} />}
        overlay={
          // 操作 UI の上ではパンを始めない。
          <div data-canvas-no-pan="">
            <BoardDateNav dateKey={dateKey} viewType={viewType} onDateChange={setDateKey} />
            <BoardControls
              viewType={viewType}
              onViewTypeChange={setViewType}
              onAddSnippet={() => setSnippetDialog({ open: true })}
              onAddPhoto={() => setPhotoDialogOpen(true)}
            />
            <CanvasZoomControls
              scale={scale}
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
              onReset={resetZoom}
              onFit={handleFit}
            />

            {/* ルート遷移中の枠と同じ PageLoading。表示が「枠 → ローダー → 本体」と
                二度変わらないよう、盤面のロード表示は1種類に揃える。 */}
            {showLoader && <PageLoading />}

            {/* 取得に失敗したまま盤面が空だと「この日は何も無い」と区別がつかないので、
                空表示ではなく理由と再試行を出す。カードが残っているときは（更新失敗でも
                盤面は使えるので）そのまま表示を続ける。 */}
            {!loading && error && cards.length === 0 && (
              <div className="absolute left-1/2 top-1/2 z-[1500] -translate-x-1/2 -translate-y-1/2">
                <ErrorState
                  message={t('error_message')}
                  onRetry={refresh}
                  retryLabel={t('retry')}
                />
              </div>
            )}

            {!loading && !error && visibleCardCount === 0 && (
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 z-[1500] -translate-x-1/2 -translate-y-1/2 text-[10px] uppercase tracking-[0.2em]"
                style={{ color: 'var(--date-color)', fontFamily: 'Inter, sans-serif' }}
              >
                {t('empty')}
              </div>
            )}

            <CanvasMinimap
              canvas={canvas}
              ariaLabel={t('minimap.aria_label')}
              items={cards.filter((c) => !c.removing).map((c) => ({ id: c.id, ...cardBounds(c) }))}
            />

            {/* Card count — ミニマップ（高さ100 + 下余白16）の上に逃がす。 */}
            <div
              className="pointer-events-none absolute right-4 z-10 text-[10px] uppercase tracking-[0.15em]"
              style={{ bottom: 124, color: 'var(--date-color)', fontFamily: 'Inter, sans-serif' }}
            >
              {visibleCardCount} CARDS
            </div>
          </div>
        }
      >
        {cards.map((card) => (
          <BoardCard
            key={card.id}
            card={card}
            detail={detail}
            isSelected={selectedId === card.id}
            isDragging={draggingId === card.id}
            onPointerDown={handleCardPointerDown}
            onRotateStart={handleRotateStart}
            onResizeStart={handleResizeStart}
            onDelete={handleDeleteCard}
            onClick={handleCardClick}
          />
        ))}
      </CanvasViewport>

      {/* Snippet dialog */}
      <SnippetDialog
        open={snippetDialog.open}
        initialText={snippetDialog.initialText}
        onSubmit={(text) => {
          if (snippetDialog.snippetId) {
            updateSnippet(snippetDialog.snippetId, text);
          } else {
            createSnippet(text, placementForNewCard(NEW_SNIPPET_WIDTH, NEW_SNIPPET_HEIGHT));
          }
        }}
        onClose={() => setSnippetDialog({ open: false })}
      />

      {/* Photo dialog */}
      <PhotoDialog
        open={photoDialogOpen}
        onSubmit={(file, caption, imageWidth, imageHeight) =>
          createPhoto(
            file,
            caption,
            imageWidth,
            imageHeight,
            placementForNewCard(NEW_PHOTO_SIZE, NEW_PHOTO_SIZE),
          )
        }
        onClose={() => setPhotoDialogOpen(false)}
      />

      {/* Photo lightbox */}
      {lightbox && (
        <div
          role="dialog"
          aria-label={t('lightbox.aria_label')}
          className="fixed inset-0 z-[2000] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
          onClick={() => setLightbox(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setLightbox(null);
          }}
        >
          <div className="flex max-h-[80vh] max-w-[80vw] flex-col items-center">
            <img
              src={lightbox.imageUrl}
              alt={lightbox.caption}
              className="max-h-[75vh] max-w-full object-contain"
            />
            {lightbox.caption && (
              <p className="mt-3 text-center text-sm italic text-white/70">{lightbox.caption}</p>
            )}
          </div>
          <button
            type="button"
            aria-label={t('lightbox.close_aria')}
            onClick={() => setLightbox(null)}
            className="absolute right-6 top-6 text-2xl text-white/70 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
