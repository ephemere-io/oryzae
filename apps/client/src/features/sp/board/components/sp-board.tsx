'use client';

// verify-exempt: データ取得（use-board）と初期フィットの採寸を担う容れ物。
// 見た目と指の操作は sp-board-surface.verify.tsx が検証する。

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorState } from '@/components/ui/error-state';
import { PageLoading } from '@/components/ui/page-loading';
import { useBoard } from '@/features/shared/board/hooks/use-board';
import { useBoardSave } from '@/features/shared/board/hooks/use-board-save';
import type { BoardCardData } from '@/features/shared/board/types';
import type { ApiClient } from '@/lib/api';
import { fitBounds, IDENTITY_VIEWPORT, unionBounds, type Viewport } from '@/lib/canvas/viewport';
import { SpBoardSurface } from './sp-board-surface';

export interface SpBoardProps {
  api: ApiClient;
}

/** 縦画面では余白を切り詰める（PC の 64px だと板が小さくなりすぎる）。 */
const FIT_PADDING = 24;

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
 */
export function SpBoard({ api }: SpBoardProps) {
  const t = useTranslations('board');
  const [dateKey] = useState(todayKey);
  const { cards, setCards, loading, error, refresh } = useBoard(api, dateKey, 'daily');
  const { savePositions } = useBoardSave(api);

  const frameRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<Viewport>(IDENTITY_VIEWPORT);
  const fittedRef = useRef(false);

  // 保存は掴んでいる間ではなく離した時に投げる。最新の配置を読むための箱。
  const cardsRef = useRef<BoardCardData[]>([]);
  cardsRef.current = cards;

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

  const handleCommit = useCallback(() => {
    // 離した位置に留める。PC と同じ debounce つきの保存を使う。
    savePositions(cardsRef.current.filter((card) => !card.removing));
  }, [savePositions]);

  if (loading && cards.length === 0) return <PageLoading />;
  if (error) return <ErrorState message={t('error_message')} onRetry={refresh} />;

  return (
    <div ref={frameRef} className="h-full w-full">
      <SpBoardSurface
        cards={cards}
        dateKey={dateKey}
        viewport={viewport}
        onMove={handleMove}
        onCommit={handleCommit}
      />
    </div>
  );
}
