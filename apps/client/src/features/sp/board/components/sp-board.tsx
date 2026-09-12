'use client';

// verify-exempt: データ取得（use-board）・パンズームの hook・画像の読み取りを束ねる容れ物。
// 見た目と指の操作は sp-board-surface / sp-board-toolbar / sp-snippet-sheet の verify が検証する。

import { MAX_OCR_IMAGE_BYTES, OCR_ALLOWED_IMAGE_TYPES } from '@oryzae/shared';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CanvasZoomControls } from '@/components/ui/canvas-zoom-controls';
import { ErrorState } from '@/components/ui/error-state';
import { PageLoading } from '@/components/ui/page-loading';
import { CONTROL_FONT } from '@/components/ui/surface';
import { useBoard } from '@/features/shared/board/hooks/use-board';
import { useBoardSave } from '@/features/shared/board/hooks/use-board-save';
import { useOcrSnippetText } from '@/features/shared/board/hooks/use-ocr-snippet-text';
import type { BoardCardData, CardPlacement } from '@/features/shared/board/types';
import type { ApiClient } from '@/lib/api';
import { useCanvasViewport } from '@/lib/canvas/use-canvas-viewport';
import { type Bounds, unionBounds } from '@/lib/canvas/viewport';
import { readImageDimensions, resizeImage } from '@/lib/image';
import { SpBoardSurface } from './sp-board-surface';
import { SpBoardToolbar } from './sp-board-toolbar';
import { type SpSnippetOcrStatus, SpSnippetSheet } from './sp-snippet-sheet';

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

/** 見えているカード全体の world 矩形。無ければ null。 */
function boundsOf(cards: readonly BoardCardData[]): Bounds | null {
  return unionBounds(
    cards
      .filter((card) => !card.removing)
      .map((card) => ({ x: card.x, y: card.y, width: card.width, height: card.height })),
  );
}

function isAllowedOcrImage(file: File): boolean {
  return OCR_ALLOWED_IMAGE_TYPES.some((allowed) => allowed === file.type);
}

/**
 * SP のボード画面。
 *
 * 盤面は PC と同じ `useCanvasViewport` の上に置く: 2 本指で寄り引き、空白の 1 本指でパン、
 * 引き切ってさらにつまむと書斎へ戻る（`PullBackToStudy`）。開いたときに一度だけ全体が
 * 入る倍率へ合わせ、以後は合わせ直さない（カードを動かすたびに再フィットすると盤面が
 * 飛び跳ねる）。
 *
 * 作る・直すは PC（#524）と同じ「下部中央の道具箱が、選んでいるものに応じて
 * 入れ替わる」形。**画像から読み取る**もここに戻した（写真を撮るのはスマホの側）。
 * 端末の写真アプリを開く `<input type="file">` は、押した指の中で開かないと iOS が
 * 拒むので、このコンポーネントが持って道具箱とシートの両方から同期的に叩く。
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
  const ocr = useOcrSnippetText(api);

  // 保存は掴んでいる間ではなく離した時に投げる。最新の配置を読むための箱。
  const cardsRef = useRef<BoardCardData[]>([]);
  cardsRef.current = cards;

  const canvas = useCanvasViewport({
    fitPadding: FIT_PADDING,
    getContentBounds: () => boundsOf(cardsRef.current),
  });
  const { fitTo, frameSize } = canvas;
  const fittedRef = useRef(false);

  const photoRef = useRef<HTMLInputElement>(null);
  const ocrInputRef = useRef<HTMLInputElement>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState<{ imageUrl: string; caption: string } | null>(null);

  // 画像から読み取った下書き。シートが閉じれば捨てる。
  const [ocrStatus, setOcrStatus] = useState<SpSnippetOcrStatus>('idle');
  const [ocrText, setOcrText] = useState<string | null>(null);

  const selected = useMemo(
    () => cards.find((card) => card.id === selectedId) ?? null,
    [cards, selectedId],
  );

  // 初期フィット。frame の採寸ができるまで（レイアウト確定を待って）数フレーム粘る。
  useEffect(() => {
    if (fittedRef.current || loading) return;
    const bounds = boundsOf(cards);
    if (!bounds) return;

    let frame = 0;
    let tries = 0;
    const attempt = () => {
      if (fittedRef.current) return;
      const size = frameSize();
      if (size.width === 0 || size.height === 0) {
        if (tries++ < 60) frame = requestAnimationFrame(attempt);
        return;
      }
      fitTo(bounds);
      fittedRef.current = true;
    };
    attempt();
    return () => cancelAnimationFrame(frame);
  }, [cards, loading, fitTo, frameSize]);

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
  const placement = useCallback((): CardPlacement => {
    const center = canvas.centerWorld();
    return { x: center.x - NEW_CARD_SIZE.width / 2, y: center.y - NEW_CARD_SIZE.height / 2 };
  }, [canvas]);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    setOcrStatus('idle');
    setOcrText(null);
  }, []);

  const handleSubmitSnippet = useCallback(
    async (text: string) => {
      setBusy(true);
      try {
        if (selected && selected.cardType === 'snippet') {
          await updateSnippet(selected.refId, text);
        } else {
          await createSnippet(text, placement());
        }
        closeSheet();
      } finally {
        setBusy(false);
      }
    },
    [selected, updateSnippet, createSnippet, placement, closeSheet],
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

  /** 端末の写真アプリを開く。押した指の中で呼ぶこと（後から呼ぶと iOS が拒む）。 */
  const pickOcrImage = useCallback(() => {
    setSelectedId(null);
    ocrInputRef.current?.click();
  }, []);

  const handleOcrFile = useCallback(
    async (file: File) => {
      setSelectedId(null);
      setSheetOpen(true);
      if (!isAllowedOcrImage(file) || file.size > MAX_OCR_IMAGE_BYTES) {
        // 送る前に弾く。サーバーも同じ条件で 400 を返すが、往復を待たせない。
        setOcrStatus('failed');
        return;
      }
      setOcrStatus('reading');
      const result = await ocr(file);
      if (result.status === 'ok') {
        // 読み取り結果はそのまま貼らず、シートの欄に載せて直してから保存する。
        setOcrText(result.text);
        setOcrStatus('idle');
        return;
      }
      setOcrStatus(result.status);
    },
    [ocr],
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

  const handleOpen = useCallback(() => {
    if (selected?.cardType !== 'photo' || !('imageUrl' in selected.content)) return;
    setLightbox({ imageUrl: selected.content.imageUrl, caption: selected.content.caption });
  }, [selected]);

  if (loading && cards.length === 0) return <PageLoading />;
  if (error) return <ErrorState message={t('error_message')} onRetry={refresh} />;

  const editingSnippet = selected !== null && selected.cardType === 'snippet';
  const sheetInitialText =
    editingSnippet && 'text' in selected.content ? selected.content.text : (ocrText ?? '');

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* 盤面は残りの高さいっぱい。道具箱はその下に**流れの中で**置く（浮かせると
          盤面の下端のカードに被り、指で掴めなくなる — 実機レビュー）。 */}
      <div className="relative min-h-0 flex-1">
        <SpBoardSurface
          cards={cards}
          dateKey={dateKey}
          viewport={canvas.viewport}
          canvas={canvas}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onMove={handleMove}
          onTransform={handleTransform}
          onCommit={handleCommit}
          overlay={
            <CanvasZoomControls
              scale={canvas.viewport.scale}
              onZoomIn={canvas.zoomIn}
              onZoomOut={canvas.zoomOut}
              onReset={canvas.resetZoom}
              onFit={() => fitTo(boundsOf(cardsRef.current))}
            />
          }
        />
      </div>

      <div className="flex shrink-0 justify-center px-4 pt-2 pb-4">
        <SpBoardToolbar
          selectedType={selected?.cardType ?? null}
          busy={busy}
          onEdit={() => setSheetOpen(true)}
          onOpen={handleOpen}
          onBringToFront={handleBringToFront}
          onDelete={handleDelete}
          onCreateSnippet={() => {
            setSelectedId(null);
            setSheetOpen(true);
          }}
          onReadImage={pickOcrImage}
          onCreatePhoto={() => photoRef.current?.click()}
        />
      </div>

      <SpSnippetSheet
        open={sheetOpen}
        mode={editingSnippet ? 'edit' : 'create'}
        initialText={sheetInitialText}
        saving={busy}
        ocrStatus={ocrStatus}
        fromImage={ocrText !== null}
        onPickImage={pickOcrImage}
        onSubmit={handleSubmitSnippet}
        onClose={closeSheet}
      />

      {/* 写真を大きく見る。右ペインが無い SP では、これが唯一の「開く」。 */}
      {lightbox ? (
        // biome-ignore lint/a11y/useKeyWithClickEvents: 閉じるボタンがキーボードの道。背景の click は補助
        <div
          role="dialog"
          aria-label={t('lightbox.aria_label')}
          className="absolute inset-0 z-40 flex flex-col items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.88)' }}
          onClick={() => setLightbox(null)}
        >
          {/* biome-ignore lint/performance/noImgElement: Supabase storage の署名付き URL */}
          <img
            src={lightbox.imageUrl}
            alt={lightbox.caption}
            className="max-h-full max-w-full object-contain"
            draggable={false}
          />
          {lightbox.caption ? (
            <p className="mt-3 text-center text-sm text-white/75">{lightbox.caption}</p>
          ) : null}
          <button
            type="button"
            aria-label={t('lightbox.close_aria')}
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-white"
            style={{ ...CONTROL_FONT, background: 'rgba(255,255,255,0.14)' }}
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* 写真は端末の写真アプリ／カメラから選ぶ。SP に貼り付けもドロップも無い。 */}
      <input
        ref={photoRef}
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
      {/* 画像から文字を読み取る。写真として貼るのとは別の入口（意図が違う）。 */}
      <input
        ref={ocrInputRef}
        type="file"
        accept={OCR_ALLOWED_IMAGE_TYPES.join(',')}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) handleOcrFile(file);
        }}
      />
    </div>
  );
}
