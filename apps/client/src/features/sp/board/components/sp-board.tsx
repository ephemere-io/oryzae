'use client';

// verify-exempt: データ取得（use-board）と初期の寄せ方の採寸を担う容れ物。
// 見た目と指の操作は sp-board-surface.verify.tsx が検証する。

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorState } from '@/components/ui/error-state';
import { PageLoading } from '@/components/ui/page-loading';
import { useBoard } from '@/features/shared/board/hooks/use-board';
import { useBoardSave } from '@/features/shared/board/hooks/use-board-save';
import type { BoardCardData, CardPlacement } from '@/features/shared/board/types';
import type { ApiClient } from '@/lib/api';
import { useCanvasViewport } from '@/lib/canvas/use-canvas-viewport';
import { unionBounds } from '@/lib/canvas/viewport';
import { readImageDimensions, resizeImage } from '@/lib/image';
import { SpBoardSurface } from './sp-board-surface';
import { SpBoardToolbar } from './sp-board-toolbar';
import { SpSnippetSheet } from './sp-snippet-sheet';

export interface SpBoardProps {
  api: ApiClient;
}

/** `fitTo` が使う余白（`fitBounds` の既定値）。初期表示の採寸をこれに合わせる。 */
const FIT_PADDING = 64;

/** 送信前の縮小。PC と同じ（ライトボックスで拡大しても荒れない上限）。 */
const MAX_UPLOAD_WIDTH = 2400;
const JPEG_QUALITY = 0.9;

/** 新しいカードの既定の大きさ（world）。中身が入れば伸びる。 */
const NEW_CARD_SIZE = { width: 262, height: 120 };

/** カード1枚の world 矩形。 */
function cardBounds(card: BoardCardData) {
  return { x: card.x, y: card.y, width: card.width, height: card.height };
}

/**
 * SP のボード画面。PC と同じ、1 人に 1 枚のコルクボード（日付も表示単位も持たない）。
 *
 * 盤面は PC と同じ `useCanvasViewport` の上に置く: **カードの上の 1 本指はカードを動かす、
 * 空きの 1 本指は盤面を動かす、2 本指は寄り引き**。以前は「開いたときに全体を収めて、
 * 以後は動かせない」形だったが、ボードが 1 枚にまとまって物が増えると、全部を収める倍率では
 * 字が読めず、画面の外のカードにも指が届かなくなった（実機レビュー）。
 *
 * 開いた直後は**いちばん新しいカードに等倍で寄せる**。全体を見たいときはピンチで引く。
 *
 * 作る・直すは PC（#524）と同じ「下部中央の道具箱が、選んでいるものに応じて
 * 入れ替わる」形。道具の実体は SP 用に作り直してある（reach 分離と、指の当たりの大きさ）。
 */
export function SpBoard({ api }: SpBoardProps) {
  const t = useTranslations('board');
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

  const fileRef = useRef<HTMLInputElement>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // 保存は掴んでいる間ではなく離した時に投げる。最新の配置を読むための箱。
  const cardsRef = useRef<BoardCardData[]>([]);
  cardsRef.current = cards;

  const canvas = useCanvasViewport({
    // 「全体を見る」（道具箱・キーボード）で収める範囲。
    getContentBounds: () =>
      unionBounds(cardsRef.current.filter((card) => !card.removing).map(cardBounds)),
  });

  const selected = useMemo(
    () => cards.find((card) => card.id === selectedId) ?? null,
    [cards, selectedId],
  );

  /**
   * 開いた直後の寄せ方。**一度だけ**。
   *
   * 全部を収めると、貼るほど 1 枚が小さくなって本文が読めない（実測: 7 枚で 0.24 倍・
   * 画面上 4px）。いちばん新しいカードを画面の真ん中に、等倍で置く。
   */
  const openedRef = useRef(false);
  useEffect(() => {
    if (openedRef.current || loading) return;
    const visible = cards.filter((card) => !card.removing);
    if (visible.length === 0) return;
    const size = canvas.frameSize();
    if (size.width === 0 || size.height === 0) return;

    const newest = visible.reduce((latest, card) =>
      card.createdAt >= latest.createdAt ? card : latest,
    );
    // 画面と同じ大きさの矩形を新しいカードの中心に置く ＝ 等倍で中央に寄せる。
    const halfWidth = Math.max(NEW_CARD_SIZE.width / 2, (size.width - FIT_PADDING * 2) / 2);
    const halfHeight = Math.max(NEW_CARD_SIZE.height / 2, (size.height - FIT_PADDING * 2) / 2);
    canvas.fitTo({
      x: newest.x + newest.width / 2 - halfWidth,
      y: newest.y + newest.height / 2 - halfHeight,
      width: halfWidth * 2,
      height: halfHeight * 2,
    });
    openedRef.current = true;
  }, [cards, loading, canvas]);

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
    const size = canvas.frameSize();
    if (size.width === 0 || size.height === 0) return undefined;
    const center = canvas.centerWorld();
    return { x: center.x - NEW_CARD_SIZE.width / 2, y: center.y - NEW_CARD_SIZE.height / 2 };
  }, [canvas]);

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

  /**
   * カードを 1 枚、前面へ出す。
   *
   * 道具箱の「前面へ」と、**カードをタップしたとき**の両方から呼ぶ。重なった板では
   * 下のカードに触れても埋もれたままだと読めない（実機レビュー指摘）。
   * 既に最前面なら何もしない — 触るたびに保存要求が飛ぶのを避ける。
   */
  const raiseToFront = useCallback(
    (cardId: string) => {
      const current = cardsRef.current;
      const top = Math.max(0, ...current.map((card) => card.zIndex));
      const target = current.find((card) => card.id === cardId);
      if (!target || target.zIndex >= top) return;

      const raise = (card: BoardCardData): BoardCardData =>
        card.id === cardId ? { ...card, zIndex: top + 1, userPositioned: true } : card;

      setCards((previous) => previous.map(raise));
      // setCards は次のレンダーで反映されるので、保存は最新の配列を自分で作って渡す。
      savePositions(current.filter((card) => !card.removing).map(raise));
    },
    [setCards, savePositions],
  );

  const handleBringToFront = useCallback(() => {
    if (selected) raiseToFront(selected.id);
  }, [selected, raiseToFront]);

  const handleDelete = useCallback(async () => {
    if (!selected) return;
    setSelectedId(null);
    await deleteCard(selected.id, selected.cardType, selected.refId);
  }, [selected, deleteCard]);

  if (loading && cards.length === 0) return <PageLoading />;
  if (error) return <ErrorState message={t('error_message')} onRetry={refresh} />;

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* 盤面は残りの高さいっぱい。道具箱はその下に**流れの中で**置く（浮かせると
          盤面の下端のカードに被り、指で掴めなくなる — 実機レビュー）。 */}
      <div className="relative min-h-0 flex-1">
        <SpBoardSurface
          cards={cards}
          canvas={canvas}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRaise={raiseToFront}
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
