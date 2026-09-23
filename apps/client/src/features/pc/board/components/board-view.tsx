'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackLink } from '@/components/ui/back-link';
import { CanvasGrid } from '@/components/ui/canvas-grid';
import { CanvasMinimap } from '@/components/ui/canvas-minimap';
import { CanvasViewport } from '@/components/ui/canvas-viewport';
import { CanvasZoomControls } from '@/components/ui/canvas-zoom-controls';
import { ErrorState } from '@/components/ui/error-state';
import { PageLoading } from '@/components/ui/page-loading';
import { useBoard } from '@/features/shared/board/hooks/use-board';
import { useBoardSave } from '@/features/shared/board/hooks/use-board-save';
import { type ResizeCorner, selectionBounds } from '@/features/shared/board/selection';
import type { BoardCardData } from '@/features/shared/board/types';
import { raiseManyToFront } from '@/features/shared/board/z-order';
import type { ApiClient } from '@/lib/api';
import { useCanvasViewport } from '@/lib/canvas/use-canvas-viewport';
import { type Bounds, unionBounds } from '@/lib/canvas/viewport';
import { useEscapeKey } from '@/lib/use-escape-key';
import { useBoardInteraction } from '../hooks/use-board-interaction';
import { useImageIntake } from '../hooks/use-image-intake';
import {
  BoardCard,
  type CardDetail,
  DETAIL_THRESHOLD_FULL,
  DETAIL_THRESHOLD_TITLE,
} from './board-card';
import { BoardToolbar } from './board-toolbar';
import { PhotoDialog } from './photo-dialog';
import { SelectionFrame } from './selection-frame';
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

/**
 * PC のボード画面。1 人に 1 枚のコルクボードに、付箋と写真を貼っていく。
 *
 * 日付を送る・日次/週次を切り替えるといった「見方」は持たない。いつ貼ったものでも
 * 同じ 1 枚の上にある。
 */
export function BoardView({ api }: BoardViewProps) {
  const t = useTranslations('board');
  const [snippetDialog, setSnippetDialog] = useState<{
    open: boolean;
    snippetId?: string;
    initialText?: string;
    source?: 'text' | 'image';
  }>({ open: false });

  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  /** カード上の編集。入り口は hook に閉じてあり、下書きを積まずには入れない。 */
  /** 貼り付け・ドロップで入ってきた画像。写真ダイアログへ選択済みとして渡す。 */
  const [incomingImage, setIncomingImage] = useState<File | null>(null);
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
  } = useBoard(api);
  const { savePositions } = useBoardSave(api);

  // ショートカット（Shift+1/2）から最新のカード・選択を読むための箱。
  // hook 側は ref 越しに呼ぶので、ここで毎レンダー新しい関数を渡してよい。
  const cardsRef = useRef<BoardCardData[]>([]);
  const selectedIdsRef = useRef<string[]>([]);

  const canvas = useCanvasViewport({
    storageKey: 'board',
    getContentBounds: () =>
      unionBounds(cardsRef.current.filter((c) => !c.removing).map(cardBounds)),
    // 選択へ寄せるときは、選んでいる**全部**が入るところまで。
    getSelectionBounds: () => selectionBounds(cardsRef.current, selectedIdsRef.current),
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

  // 保存するのは **hook が作った配列**。ここで state の `cards` を読むと、直前の
  // setCards がまだ反映されておらず、前面へ出した z が保存から漏れる。
  const handleInteractionEnd = useCallback(
    (next: BoardCardData[]) => {
      savePositions(next);
    },
    [savePositions],
  );

  const {
    selectedIds,
    selectedId,
    groupBounds,
    draggingId,
    startDrag,
    startRotate,
    startResize,
    onPointerMove,
    onPointerUp,
    deselect,
    didDrag,
    consumeGestureEnd,
  } = useBoardInteraction(cards, handleCardsChange, handleInteractionEnd, scale);

  cardsRef.current = cards;
  selectedIdsRef.current = selectedIds;

  // ── ポインタ座標の world 変換 ───────────────────────────────────
  // カードは clientX/Y を上げてくるので、ここで world に直してから hook に渡す。
  // これで useBoardInteraction は倍率を知らずに済む（回転は中心・ポインタとも world に
  // そろえる。等方スケールなので角度は変わらない）。
  const handleCardPointerDown = useCallback(
    (cardId: string, clientX: number, clientY: number, additive: boolean) => {
      const p = toWorld(clientX, clientY);
      startDrag(cardId, p.x, p.y, additive);
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
    (cardId: string, corner: ResizeCorner, clientX: number, clientY: number) => {
      const p = toWorld(clientX, clientY);
      startResize(cardId, corner, p.x, p.y);
    },
    [toWorld, startResize],
  );

  /** 群の枠の角。対象は「選んでいる全部」なので cardId は渡さない。 */
  const handleGroupResizeStart = useCallback(
    (corner: ResizeCorner, clientX: number, clientY: number) => {
      const p = toWorld(clientX, clientY);
      startResize(null, corner, p.x, p.y);
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

  /** カードをダブルクリックしたときの行き先。 */
  const openCard = useCallback((card: BoardCardData) => {
    if (card.cardType === 'snippet' && 'text' in card.content) {
      setSnippetDialog({ open: true, snippetId: card.refId, initialText: card.content.text });
    } else if (card.cardType === 'photo' && 'imageUrl' in card.content) {
      setLightbox({ imageUrl: card.content.imageUrl, caption: card.content.caption });
    }
  }, []);

  const handleCardClick = useCallback(
    (card: BoardCardData) => {
      // 掴んで動かしただけのときは開かない。ツールバー経由（openCard 直呼び）には
      // この判定を通さない——ボタンを押したのは明確な意思表示なので。
      if (didDrag()) return;
      openCard(card);
    },
    [openCard, didDrag],
  );

  /** 選択中のカード。ツールバーが「そのカードにできること」を出すために使う。 */
  const selectedCard = selectedId ? (cards.find((c) => c.id === selectedId) ?? null) : null;

  const handleOpenSelected = useCallback(() => {
    if (selectedCard) openCard(selectedCard);
  }, [selectedCard, openCard]);

  /**
   * 選択中のカードを最前面へ。重なって読めなくなったときの逃げ道。
   * 複数選んでいるときは**互いの重なり順を保ったまま**まとめて上げる
   * （採番の規則は PC と SP で共有している `features/shared/board/z-order`）。
   */
  const handleBringToFront = useCallback(() => {
    const next = raiseManyToFront(cards, selectedIds);
    if (next === null) return;
    setCards(next);
    savePositions(next);
  }, [cards, selectedIds, setCards, savePositions]);

  const handleDeleteCard = useCallback(
    (cardId: string) => {
      const card = cards.find((c) => c.id === cardId);
      if (!card) return;
      deleteCard(cardId, card.cardType, card.refId);
    },
    [cards, deleteCard],
  );

  /** 選んでいる全部を消す。1 枚でも複数でも入り口は同じ。 */
  const handleDeleteSelected = useCallback(() => {
    for (const id of selectedIds) handleDeleteCard(id);
  }, [selectedIds, handleDeleteCard]);

  const openSnippetDialog = useCallback(() => setSnippetDialog({ open: true }), []);
  /** 画像から読み取る。作成ダイアログを画像タブで開くので、1手で読み取りに着く。 */
  const openOcrDialog = useCallback(() => setSnippetDialog({ open: true, source: 'image' }), []);

  const openPhotoDialog = useCallback(() => {
    setIncomingImage(null);
    setPhotoDialogOpen(true);
  }, []);

  // 貼り付け（Cmd+V）とドロップ。どちらもツールバーの「画像を貼り付け」と同じ着地点へ。
  const handleIncomingImage = useCallback((file: File) => {
    setIncomingImage(file);
    setPhotoDialogOpen(true);
  }, []);
  const closeLightbox = useCallback(() => setLightbox(null), []);

  // ライトボックスも Escape で閉じる（各ダイアログと揃える）。
  useEscapeKey(lightbox !== null, closeLightbox);

  const dialogOpen = snippetDialog.open || photoDialogOpen || lightbox !== null;

  // 何かが開いている間は横取りしない。スニペット編集中は本文への貼り付けを奪わないため。
  // 写真ダイアログを開いている間も同じで、ここを開けておくと、選択済みの画像がある状態で
  // 貼り付けたときに initialFile が差し替わり、選んだ画像が黙って別のものになる。
  const intake = useImageIntake(!dialogOpen, handleIncomingImage);

  // Keyboard handling: Delete/Backspace で選択カードを消す ＋ ツールバーのショートカット。
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // e.target は EventTarget で、HTMLElement とは限らない（document / window /
      // SVGElement も来る）。キャストで名乗らせず instanceof で確かめる。
      const target = e.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
      }
      // 何かが開いている間はボードのキー操作を一切拾わない（閉じるのは Escape の仕事）。
      // 削除より後ろに置くと、ライトボックスやダイアログの入力欄以外にフォーカスが
      // ある状態の Backspace が、背後で選択中のカードをサーバーごと消してしまう。
      if (dialogOpen) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault();
          handleDeleteSelected();
        }
        return;
      }

      // ツールのショートカット（Figma と同じく修飾キーなしの1文字）。
      // 変換中は拾わない。日本語入力の途中で押した "s" を preventDefault すると、
      // ローマ字が食われたうえにダイアログまで開く（use-escape-key と同じ理由）。
      if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 's') {
        e.preventDefault();
        openSnippetDialog();
      } else if (key === 'i') {
        e.preventDefault();
        openPhotoDialog();
      } else if (key === 'r') {
        e.preventDefault();
        openOcrDialog();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedIds,
    handleDeleteSelected,
    dialogOpen,
    openSnippetDialog,
    openPhotoDialog,
    openOcrDialog,
  ]);

  const visibleCardCount = cards.filter((c) => !c.removing).length;

  return (
    <div
      {...verifyAttrs({
        unit: 'BoardView',
        snippetOpen: snippetDialog.open,
        photoOpen: photoDialogOpen,
        percent: Math.round(scale * 100),
        detail,
        selectedType: selectedCard?.cardType ?? 'none',
      })}
      // role / aria-label と、ポインタ操作・選択解除は CanvasViewport が持つ。
      // ここで overflow-auto にはしない（スクロールはパンに置き換わった）。
      // ヘルプが開いているとき、この画面に触れたら「ボード」を出す（上段バーは道具箱に統合されて無い）。
      data-help="board"
      className="relative h-full w-full"
      // 画像の受け取りだけは面の外側で受ける。ドラッグ&ドロップはポインタ操作とは
      // イベントの系統が違うので、パンとは競合しない。
      onDragOver={intake.onDragOver}
      onDragLeave={intake.onDragLeave}
      onDrop={intake.onDrop}
    >
      {/* 左上の出口（書斎が無効なら描かれない）。盤面はヘッダーを持たないので、
          瓶（jar-view）と同じく隅に置く。日付ナビと表示単位の切り替えがあったころは
          上段バーの中に並べていたが、ボードが 1 人に 1 枚になってバーごと無くなった。 */}
      <BackLink placement="corner" />

      <CanvasViewport
        canvas={canvas}
        ariaLabel={t('canvas.aria_label')}
        style={{ backgroundColor: 'var(--bg)' }}
        onPointerMove={handleFramePointerMove}
        onPointerUp={onPointerUp}
        // 空きを押したら選択を解除する。ただし**掴んで動かした直後の click** は数えない。
        // 指を離した位置が掴んだ要素の外だと、ブラウザは click を共通の親＝この盤面に
        // 送るので、そのままだと「大きさを変え終えた瞬間に選択が消える」。
        onClick={() => {
          if (consumeGestureEnd()) return;
          deselect();
        }}
        background={<CanvasGrid canvas={canvas} />}
        overlay={
          // 操作 UI の上ではパンを始めない。
          <div data-canvas-no-pan="">
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

            {/* 取得に失敗したまま盤面が空だと「まだ何も貼っていない」と区別がつかないので、
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
                {t('nothing_pinned')}
              </div>
            )}

            <CanvasMinimap
              canvas={canvas}
              ariaLabel={t('minimap.aria_label')}
              items={cards.filter((c) => !c.removing).map((c) => ({ id: c.id, ...cardBounds(c) }))}
            />

            {/* 「n CARDS」は置かない。PR #524 で「常に見えている必要がない」として
                外されたもので、こちらのマージで復活させてしまっていた（E2E が検出）。 */}
          </div>
        }
      >
        {cards.map((card) => (
          <BoardCard
            key={card.id}
            card={card}
            detail={detail}
            isSelected={selectedIds.includes(card.id)}
            // つまみを出すのは 1 枚だけ選んでいるとき。複数のときは群の枠が持つ。
            showHandles={selectedId === card.id}
            isDragging={draggingId === card.id}
            onPointerDown={handleCardPointerDown}
            onRotateStart={handleRotateStart}
            onResizeStart={handleResizeStart}
            onClick={handleCardClick}
          />
        ))}

        {/* 複数選んでいるときだけ出る群の枠。カードと同じ world 空間に置く。 */}
        {groupBounds !== null && (
          <SelectionFrame
            bounds={groupBounds}
            count={selectedIds.length}
            onResizeStart={handleGroupResizeStart}
          />
        )}
      </CanvasViewport>

      {/* ドラッグ中の目印。受け取れることが分からないと、そもそも落としてもらえない。
          画面全体を覆うので、面（CanvasViewport）の外に置く。 */}
      {intake.dragActive && (
        <div
          className="pointer-events-none fixed inset-0 z-[1700] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.06)' }}
        >
          <span
            className="rounded-lg border border-dashed px-4 py-2 text-[11px] uppercase tracking-[0.08em]"
            style={{
              borderColor: 'var(--fg)',
              color: 'var(--fg)',
              backgroundColor: 'var(--surface-raised)',
              fontFamily: 'Inter, "Noto Sans JP", sans-serif',
            }}
          >
            {t('drop_image')}
          </span>
        </div>
      )}

      {/* 道具箱（下部中央フローティング）。面の外に置くので、掴んでもパンは始まらない。 */}
      <BoardToolbar
        activeTool={
          snippetDialog.open
            ? snippetDialog.source === 'image'
              ? 'ocr'
              : 'snippet'
            : photoDialogOpen
              ? 'photo'
              : 'none'
        }
        onCreateSnippet={openSnippetDialog}
        onReadImage={openOcrDialog}
        onAddPhoto={openPhotoDialog}
        selection={
          selectedIds.length > 0
            ? { count: selectedIds.length, cardType: selectedCard?.cardType ?? null }
            : null
        }
        onOpenSelected={handleOpenSelected}
        onBringSelectedToFront={handleBringToFront}
        onDeleteSelected={handleDeleteSelected}
      />

      {/* Snippet dialog */}
      <SnippetDialog
        open={snippetDialog.open}
        api={api}
        snippetId={snippetDialog.snippetId}
        initialText={snippetDialog.initialText}
        initialSource={snippetDialog.source ?? 'text'}
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
        initialFile={incomingImage}
        onSubmit={(file, caption, imageWidth, imageHeight) =>
          createPhoto(
            file,
            caption,
            imageWidth,
            imageHeight,
            placementForNewCard(NEW_PHOTO_SIZE, NEW_PHOTO_SIZE),
          )
        }
        onClose={() => {
          setPhotoDialogOpen(false);
          setIncomingImage(null);
        }}
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
