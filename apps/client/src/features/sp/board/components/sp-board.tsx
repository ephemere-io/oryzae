'use client';

// verify-exempt: データ取得（use-board）と初期フィットの採寸を担う容れ物。
// 見た目と指の操作は sp-board-surface.verify.tsx が検証する。

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorState } from '@/components/ui/error-state';
import { PageLoading } from '@/components/ui/page-loading';
import { useBoard } from '@/features/shared/board/hooks/use-board';
import { useBoardSave } from '@/features/shared/board/hooks/use-board-save';
import type { BoardCardData, CardPlacement } from '@/features/shared/board/types';
import type { ApiClient } from '@/lib/api';
import {
  fitBounds,
  IDENTITY_VIEWPORT,
  unionBounds,
  type Viewport,
  viewportCenterWorld,
} from '@/lib/canvas/viewport';
import { readImageDimensions, resizeImage } from '@/lib/image';
import { SpBoardSurface } from './sp-board-surface';
import { SpBoardToolbar } from './sp-board-toolbar';
import { SpSnippetSheet } from './sp-snippet-sheet';

export interface SpBoardProps {
  api: ApiClient;
}

/** 縦画面では余白を切り詰める（PC の 64px だと板が小さくなりすぎる）。 */
const FIT_PADDING = 24;

/** 送信前の縮小。PC と同じ（ライトボックスで拡大しても荒れない上限）。 */
const MAX_UPLOAD_WIDTH = 2400;
const JPEG_QUALITY = 0.9;

/** 新しいカードの既定の大きさ（world）。中身が入れば伸びる。 */
const NEW_CARD_SIZE = { width: 262, height: 120 };

/** ローカル暦日の `YYYY-MM-DD`。 */
function todayKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * SP のボード画面。
 *
 * 盤面は開いたときに一度だけ全体が入る倍率へ合わせる。world 座標は無制限なので、
 * 合わせないと画面外のカードに指が届かない。合わせ直しは**しない** — カードを
 * 動かすたびに再フィットすると盤面が飛び跳ねる。
 *
 * 作る・直すは PC（#524）と同じ「下部中央の道具箱が、選んでいるものに応じて
 * 入れ替わる」形。道具の実体は SP 用に作り直してある（reach 分離と、指の当たりの大きさ）。
 */
export function SpBoard({ api }: SpBoardProps) {
  const t = useTranslations('board');
  const [dateKey] = useState(todayKey);
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
  } = useBoard(api, dateKey, 'daily');
  const { savePositions } = useBoardSave(api);

  const frameRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [viewport, setViewport] = useState<Viewport>(IDENTITY_VIEWPORT);
  const fittedRef = useRef(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // 保存は掴んでいる間ではなく離した時に投げる。最新の配置を読むための箱。
  const cardsRef = useRef<BoardCardData[]>([]);
  cardsRef.current = cards;

  const selected = useMemo(
    () => cards.find((card) => card.id === selectedId) ?? null,
    [cards, selectedId],
  );

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || fittedRef.current || loading) return;

    const visible = cards.filter((card) => !card.removing);
    if (visible.length === 0) return;

    const bounds = unionBounds(
      visible.map((card) => ({ x: card.x, y: card.y, width: card.width, height: card.height })),
    );
    if (!bounds) return;

    const size = { width: frame.clientWidth, height: frame.clientHeight };
    if (size.width === 0 || size.height === 0) return;

    setViewport(fitBounds(bounds, size, FIT_PADDING));
    fittedRef.current = true;
  }, [cards, loading]);

  const handleMove = useCallback(
    (cardId: string, x: number, y: number) => {
      setCards((previous) =>
        previous.map((card) =>
          card.id === cardId
            ? // 一度でも動かしたら「利用者が置いた」カード扱いにする。これが無いと
              // 次の取得で自動整列（applyDefaultZOrder）に巻き込まれ、位置が戻る。
              { ...card, x, y, userPositioned: true }
            : card,
        ),
      );
    },
    [setCards],
  );

  const handleTransform = useCallback(
    (cardId: string, next: { rotation: number; width: number; height: number }) => {
      setCards((previous) =>
        previous.map((card) =>
          card.id === cardId ? { ...card, ...next, userPositioned: true } : card,
        ),
      );
    },
    [setCards],
  );

  const handleCommit = useCallback(() => {
    // 離した位置に留める。PC と同じ debounce つきの保存を使う。
    savePositions(cardsRef.current.filter((card) => !card.removing));
  }, [savePositions]);

  /** 新しいカードを置く場所＝いま見えている真ん中。遠くを見ていても画面内に生まれる。 */
  const placement = useCallback((): CardPlacement | undefined => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    const center = viewportCenterWorld(viewport, {
      width: frame.clientWidth,
      height: frame.clientHeight,
    });
    return { x: center.x - NEW_CARD_SIZE.width / 2, y: center.y - NEW_CARD_SIZE.height / 2 };
  }, [viewport]);

  const handleSubmitSnippet = useCallback(
    async (text: string) => {
      setBusy(true);
      try {
        if (selected && selected.cardType === 'snippet') {
          await updateSnippet(selected.refId, text);
        } else {
          await createSnippet(text, placement());
        }
        setSheetOpen(false);
      } finally {
        setBusy(false);
      }
    },
    [selected, updateSnippet, createSnippet, placement],
  );

  const handlePickPhoto = useCallback(
    async (file: File) => {
      setBusy(true);
      try {
        const [{ width, height }, resized] = await Promise.all([
          readImageDimensions(file),
          resizeImage(file, MAX_UPLOAD_WIDTH, JPEG_QUALITY),
        ]);
        // 縮小後の Blob を同じ名前の File に戻す（サーバーは拡張子を見る）。
        const upload = new File([resized.blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, {
          type: 'image/jpeg',
        });
        await createPhoto(upload, '', width, height, placement());
      } catch {
        // 読めない画像（HEIC 等）や通信の失敗。盤面に専用のエラー表示が無いので、
        // 「カードが増えない」ことを結果として見せる。固まらないことだけを守る。
      } finally {
        setBusy(false);
      }
    },
    [createPhoto, placement],
  );

  const handleBringToFront = useCallback(() => {
    if (!selected) return;
    const top = Math.max(0, ...cardsRef.current.map((card) => card.zIndex));
    setCards((previous) =>
      previous.map((card) =>
        card.id === selected.id ? { ...card, zIndex: top + 1, userPositioned: true } : card,
      ),
    );
    // setCards は次のレンダーで反映されるので、保存は最新の配列を自分で作って渡す。
    savePositions(
      cardsRef.current
        .filter((card) => !card.removing)
        .map((card) =>
          card.id === selected.id ? { ...card, zIndex: top + 1, userPositioned: true } : card,
        ),
    );
  }, [selected, setCards, savePositions]);

  const handleDelete = useCallback(async () => {
    if (!selected) return;
    setSelectedId(null);
    await deleteCard(selected.id, selected.cardType, selected.refId);
  }, [selected, deleteCard]);

  if (loading && cards.length === 0) return <PageLoading />;
  if (error) return <ErrorState message={t('error_message')} onRetry={refresh} />;

  return (
    <div ref={frameRef} className="relative flex h-full w-full flex-col">
      {/* 盤面は残りの高さいっぱい。道具箱はその下に**流れの中で**置く（浮かせると
          盤面の下端のカードに被り、指で掴めなくなる — 実機レビュー）。 */}
      <div className="relative min-h-0 flex-1">
        <SpBoardSurface
          cards={cards}
          dateKey={dateKey}
          viewport={viewport}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onMove={handleMove}
          onTransform={handleTransform}
          onCommit={handleCommit}
        />
      </div>

      <div className="flex shrink-0 justify-center px-4 pt-2 pb-5">
        <SpBoardToolbar
          selectedType={selected?.cardType ?? null}
          busy={busy}
          onEdit={() => setSheetOpen(true)}
          onBringToFront={handleBringToFront}
          onDelete={handleDelete}
          onCreateSnippet={() => {
            setSelectedId(null);
            setSheetOpen(true);
          }}
          onCreatePhoto={() => fileRef.current?.click()}
        />
      </div>

      <SpSnippetSheet
        open={sheetOpen}
        initialText={
          selected && selected.cardType === 'snippet' && 'text' in selected.content
            ? selected.content.text
            : ''
        }
        saving={busy}
        onSubmit={handleSubmitSnippet}
        onClose={() => setSheetOpen(false)}
      />

      {/* 写真は端末の写真アプリ／カメラから選ぶ。SP に貼り付けもドロップも無い。 */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          // 同じ写真をもう一度選べるように空にしておく（value が同じだと change が来ない）。
          event.target.value = '';
          if (file) handlePickPhoto(file);
        }}
      />
    </div>
  );
}
