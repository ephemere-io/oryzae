'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ApiClient } from '@/lib/api';
import type { BoardCardData } from '../hooks/use-board';
import { useBoard } from '../hooks/use-board';
import { useBoardInteraction } from '../hooks/use-board-interaction';
import { useBoardSave } from '../hooks/use-board-save';
import { BoardCard } from './board-card';
import { BoardControls } from './board-controls';
import { BoardDateNav } from './board-date-nav';
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

  const { cards, setCards, loading, createSnippet, updateSnippet, createPhoto, deleteCard } =
    useBoard(api, dateKey, viewType);
  const { savePositions } = useBoardSave(api);

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

  return (
    <div
      role="application"
      aria-label="Board canvas"
      className="relative h-full w-full overflow-auto"
      style={{ backgroundColor: 'var(--bg)' }}
      onPointerMove={(e) => onPointerMove(e.clientX, e.clientY)}
      onPointerUp={onPointerUp}
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

      <BoardDateNav dateKey={dateKey} onDateChange={setDateKey} />
      <BoardControls
        viewType={viewType}
        onViewTypeChange={setViewType}
        onAddSnippet={() => setSnippetDialog({ open: true })}
        onAddPhoto={() => setPhotoDialogOpen(true)}
      />

      {/* Canvas */}
      <div className="relative min-h-full" style={{ minWidth: 1200, minHeight: 900 }}>
        {loading && cards.length === 0 && null}

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

      {/* Card count */}
      <div
        className="pointer-events-none absolute bottom-2 right-4 z-10 text-[10px] uppercase tracking-[0.15em]"
        style={{ color: 'var(--date-color)', fontFamily: 'Inter, sans-serif' }}
      >
        {cards.filter((c) => !c.removing).length} CARDS
      </div>

      {/* Snippet dialog */}
      <SnippetDialog
        open={snippetDialog.open}
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
        onSubmit={(file, caption) => createPhoto(file, caption)}
        onClose={() => setPhotoDialogOpen(false)}
      />

      {/* Photo lightbox */}
      {lightbox && (
        <div
          role="dialog"
          aria-label="Photo lightbox"
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
            aria-label="Close lightbox"
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
