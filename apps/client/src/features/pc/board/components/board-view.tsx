'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { ErrorState } from '@/components/ui/error-state';
import { PageLoading } from '@/components/ui/page-loading';
import { useBoard } from '@/features/shared/board/hooks/use-board';
import { useBoardSave } from '@/features/shared/board/hooks/use-board-save';
import { usePlaceableEntries } from '@/features/shared/board/hooks/use-placeable-entries';
import type { BoardCardData } from '@/features/shared/board/types';
import type { ApiClient } from '@/lib/api';
import { useEscapeKey } from '@/lib/use-escape-key';
import { useBoardInteraction } from '../hooks/use-board-interaction';
import { useImageIntake } from '../hooks/use-image-intake';
import { BoardCard } from './board-card';
import { BoardDateNav } from './board-date-nav';
import { BOARD_INSET, TOP_BAR_CLASS } from './board-surface';
import { BoardToolbar } from './board-toolbar';
import { BoardViewSwitch } from './board-view-switch';
import { EntryPickerDialog } from './entry-picker-dialog';
import { PhotoDialog } from './photo-dialog';
import { SnippetDialog } from './snippet-dialog';

interface BoardViewProps {
  api: ApiClient;
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
  const [entryPickerOpen, setEntryPickerOpen] = useState(false);
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
    placeEntry,
    deleteCard,
  } = useBoard(api, dateKey, viewType);
  const { savePositions } = useBoardSave(api);

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
  } = useBoardInteraction(cards, handleCardsChange, handleInteractionEnd);

  /** カードを開く（種別ごとの行き先）。ドラッグ判定は呼び出し側の責任。 */
  const openCard = useCallback(
    (card: BoardCardData) => {
      if (card.cardType === 'entry') {
        router.push(`/entries/${card.refId}`);
      } else if (card.cardType === 'snippet' && 'text' in card.content) {
        setSnippetDialog({ open: true, snippetId: card.refId, initialText: card.content.text });
      } else if (card.cardType === 'photo' && 'imageUrl' in card.content) {
        setLightbox({ imageUrl: card.content.imageUrl, caption: card.content.caption });
      }
    },
    [router],
  );

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

  /** 選択中のカードを最前面へ。重なって読めなくなったときの逃げ道。 */
  const handleBringToFront = useCallback(() => {
    if (!selectedCard) return;
    const maxZ = cards.reduce((max, c) => Math.max(max, c.zIndex), 0);
    if (selectedCard.zIndex === maxZ) return;
    const next = cards.map((c) =>
      c.id === selectedCard.id ? { ...c, zIndex: maxZ + 1, userPositioned: true } : c,
    );
    setCards(next);
    savePositions(next);
  }, [selectedCard, cards, setCards, savePositions]);

  const handleDeleteCard = useCallback(
    (cardId: string) => {
      const card = cards.find((c) => c.id === cardId);
      if (!card) return;
      deleteCard(cardId, card.cardType, card.refId);
    },
    [cards, deleteCard],
  );

  const openSnippetDialog = useCallback(() => setSnippetDialog({ open: true }), []);
  const placeable = usePlaceableEntries(api, dateKey, viewType, entryPickerOpen);

  const openEntryPicker = useCallback(() => setEntryPickerOpen(true), []);

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

  const dialogOpen = snippetDialog.open || photoDialogOpen || entryPickerOpen || lightbox !== null;

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
        if (selectedId) {
          e.preventDefault();
          handleDeleteCard(selectedId);
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
      } else if (key === 'e') {
        e.preventDefault();
        openEntryPicker();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedId,
    handleDeleteCard,
    dialogOpen,
    openSnippetDialog,
    openPhotoDialog,
    openEntryPicker,
  ]);

  return (
    <div
      {...verifyAttrs({
        unit: 'BoardView',
        viewType,
        snippetOpen: snippetDialog.open,
        photoOpen: photoDialogOpen,
        entryPickerOpen,
        selectedType: selectedCard?.cardType ?? 'none',
      })}
      role="application"
      aria-label={t('canvas.aria_label')}
      className="relative h-full w-full overflow-auto"
      style={{ backgroundColor: 'var(--bg)' }}
      onPointerMove={(e) => onPointerMove(e.clientX, e.clientY)}
      onPointerUp={onPointerUp}
      onDragOver={intake.onDragOver}
      onDragLeave={intake.onDragLeave}
      onDrop={intake.onDrop}
      onClick={deselect}
      onKeyDown={() => {}}
    >
      {/* Grid background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          opacity: 0.6,
        }}
      />

      {/* ドラッグ中の目印。受け取れることが分からないと、そもそも落としてもらえない。 */}
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

      {/* 上段バー: 左端に日付、右端に表示単位。1本のバーの両端に置くことで、
          左右に散らばって見えないようにする。 */}
      <div
        className={TOP_BAR_CLASS}
        style={{
          top: BOARD_INSET,
          // 左端はサイドバー幅ぶん寄せる
          // （--sidebar-width は (protected)/layout.tsx が <main> に生やしている）。
          left: `calc(var(--sidebar-width, 0px) + ${BOARD_INSET}px)`,
          right: BOARD_INSET,
        }}
      >
        <BoardDateNav dateKey={dateKey} viewType={viewType} onDateChange={setDateKey} />
        <BoardViewSwitch viewType={viewType} onViewTypeChange={setViewType} />
      </div>

      {/* Canvas */}
      <div className="relative min-h-full" style={{ minWidth: 1200, minHeight: 900 }}>
        {/* ルート遷移中の枠と同じ PageLoading。表示が「枠 → ローダー → 本体」と
            二度変わらないよう、盤面のロード表示は1種類に揃える。 */}
        {showLoader && <PageLoading />}

        {/* 取得に失敗したまま盤面が空だと「この日は何も無い」と区別がつかないので、
            空表示ではなく理由と再試行を出す。カードが残っているときは（更新失敗でも
            盤面は使えるので）そのまま表示を続ける。 */}
        {!loading && error && cards.length === 0 && (
          <div className="absolute left-1/2 top-1/2 z-[1500] -translate-x-1/2 -translate-y-1/2">
            <ErrorState message={t('error_message')} onRetry={refresh} retryLabel={t('retry')} />
          </div>
        )}

        {!loading && !error && cards.filter((c) => !c.removing).length === 0 && (
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 z-[1500] -translate-x-1/2 -translate-y-1/2 text-[10px] uppercase tracking-[0.2em]"
            style={{ color: 'var(--date-color)', fontFamily: 'Inter, sans-serif' }}
          >
            {t('empty')}
          </div>
        )}

        {cards.map((card) => (
          <BoardCard
            key={card.id}
            card={card}
            isSelected={selectedId === card.id}
            isDragging={draggingId === card.id}
            onPointerDown={startDrag}
            onRotateStart={startRotate}
            onResizeStart={startResize}
            onDelete={handleDeleteCard}
            onClick={handleCardClick}
          />
        ))}
      </div>

      {/* 道具箱（下部中央フローティング） */}
      <BoardToolbar
        activeTool={
          snippetDialog.open
            ? 'snippet'
            : photoDialogOpen
              ? 'photo'
              : entryPickerOpen
                ? 'entry'
                : 'none'
        }
        onCreateSnippet={openSnippetDialog}
        onAddPhoto={openPhotoDialog}
        onPlaceEntry={openEntryPicker}
        selection={selectedCard ? { cardType: selectedCard.cardType } : null}
        onOpenSelected={handleOpenSelected}
        onBringSelectedToFront={handleBringToFront}
        onDeleteSelected={() => selectedCard && handleDeleteCard(selectedCard.id)}
      />

      {/* エントリーを置く（サーバ側の自動生成をやめた代わりの入口） */}
      <EntryPickerDialog
        open={entryPickerOpen}
        entries={placeable.entries}
        loading={placeable.loading}
        error={placeable.error}
        onPlace={placeEntry}
        onClose={() => setEntryPickerOpen(false)}
      />

      {/* Snippet dialog */}
      <SnippetDialog
        open={snippetDialog.open}
        api={api}
        snippetId={snippetDialog.snippetId}
        initialText={snippetDialog.initialText}
        onSubmit={(text) => {
          if (snippetDialog.snippetId) {
            updateSnippet(snippetDialog.snippetId, text);
          } else {
            createSnippet(text);
          }
        }}
        onClose={() => setSnippetDialog({ open: false })}
      />

      {/* Photo dialog */}
      <PhotoDialog
        open={photoDialogOpen}
        initialFile={incomingImage}
        onSubmit={(file, caption, imageWidth, imageHeight) =>
          createPhoto(file, caption, imageWidth, imageHeight)
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
