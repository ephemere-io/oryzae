'use client';

// verify-exempt: router / データ取得 / three.js の dynamic import を束ねるページ級の合成。
// 中身の部品（StudyChrome / EntryListOverlay / StudyFallback）が個別に検証されている。

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEntriesByMonth } from '@/features/shared/entries/hooks/use-entries-by-month';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { DURATION, RENDER_LIMITS } from '../constants';
import { toStudyEntry, useStudyState } from '../hooks/use-study-state';
import type { StudyLayout } from '../layout';
import { overlayScope, staysInStudy, targetHref } from '../navigation';
import { monthDateRange } from '../scene/books';
import type { HoverInfo, LabelPositions } from '../scene/scene';
import type { StudyEntry, StudyTarget } from '../types';
import { EntryListOverlay } from './entry-list-overlay';
import { StudyChrome } from './study-chrome';
import { StudyFallback } from './study-fallback';
import { type LabelKind, StudyLabels } from './study-labels';
import { StudyTooltip } from './study-tooltip';

/**
 * three.js は初期バンドルに載せない（`/jar` を直接開いた人に 600KB を配らない）。
 * `ssr: false` は Client Component の中でしか効かないので、ここで指定する。
 */
const StudyCanvas = dynamic(() => import('./study-canvas').then((module) => module.StudyCanvas), {
  ssr: false,
  loading: () => <StudyFallback loading />,
});

export interface StudyHomeProps {
  /**
   * 構図。端末との対応づけは `features/pc/study` と `features/sp/study` が持つ。
   * ここでは端末を判定しない（features/shared の規約）。
   */
  layout: StudyLayout;
  /** 下端のキャプションを出すか。SP はボトムナビと競合するので出さない。 */
  showCaption?: boolean;
}

export function StudyHome({ layout, showCaption = true }: StudyHomeProps) {
  const router = useRouter();
  const { api, auth, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const { state } = useStudyState(api, authLoading, auth?.user.id ?? null);

  // 一覧オーバーレイは書斎の中で開く（URL は変わらない）。
  const [overlay, setOverlay] = useState<{ month: string | null } | null>(null);

  /**
   * 月を選んでいる間は、その月ぶんをサーバーから取り直す。
   *
   * `state.entries` は直近 20 件しか持たない（一覧のためではなく、手帳のホバーに出す
   * 日付の範囲を作るためのもの）。それを手元で月で絞ると、20 件より古い月が必ず空になる。
   */
  const { entries: monthEntries, loading: monthLoading } = useEntriesByMonth(
    api,
    overlay?.month ?? null,
  );

  /**
   * 書斎の出入りは切り替えではなく**溶暗**にする。
   *
   * - 入り: マウント直後に 0 → 1（サブ画面から戻ったときに書斎が唐突に現れない）
   * - 出: 遷移の終盤に scene から合図が来たら 1 → 0。カメラが着くのと同時に消え終わるので、
   *   行き先の画面は同じ地の色の上に現れる
   */
  const [entered, setEntered] = useState(false);
  const [leaveMs, setLeaveMs] = useState<number | null>(null);

  useEffect(() => {
    // 次のフレームで立てる。マウントと同じフレームだと transition が走らない。
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // ラベルは 3D 座標に貼り付くので、毎フレーム画面座標が届く。
  const [labelPositions, setLabelPositions] = useState<LabelPositions>(EMPTY_LABELS);
  const [hoveredLabel, setHoveredLabel] = useState<LabelKind | null>(null);
  // 手帳・背表紙のホバーで出す紙のツールチップ。
  const [hover, setHover] = useState<HoverInfo | null>(null);

  // ピルの押し戻しに canvas の実寸が要る。
  const rootRef = useRef<HTMLDivElement>(null);
  const [screen, setScreen] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      setScreen({ width: element.clientWidth, height: element.clientHeight });
    });
    observer.observe(element);
    setScreen({ width: element.clientWidth, height: element.clientHeight });
    return () => observer.disconnect();
  }, []);

  const months = useMemo(
    () => state.notebooks.map((notebook) => notebook.month),
    [state.notebooks],
  );

  /** 月を選んでいればその月ぶん、全月なら手元の直近ぶん。 */
  const overlayEntries = useMemo(
    () => (overlay?.month != null ? monthEntries.map(toStudyEntry) : state.entries),
    [overlay?.month, monthEntries, state.entries],
  );

  /** JOURNAL のピルに出す件数は**当月**のもの（積み全体ではない）。 */
  const currentMonthCount = useMemo(
    () => state.notebooks.find((notebook) => notebook.current)?.entryCount ?? 0,
    [state.notebooks],
  );

  /**
   * ARCHIVE のピルに出す冊数は**棚に入っている月**の数。
   *
   * 全月を数えると、机に積んである 3 冊まで「書庫の冊数」に混ざる（実機で
   * 「5 volumes」と出ているのに棚には 2 本しか無い、という食い違いになっていた）。
   */
  const archiveCount = useMemo(
    () => Math.max(0, state.notebooks.length - RENDER_LIMITS.deskNotebooks),
    [state.notebooks],
  );

  const handleNavigate = useCallback(
    (target: StudyTarget) => {
      const href = targetHref(target);
      // カメラが着いてから URL を変える。書斎はこの時点でもう消えている（溶暗）。
      if (href !== null) router.push(href);
    },
    [router],
  );

  const handleOpenOverlay = useCallback((target: StudyTarget) => {
    setOverlay(overlayScope(target));
  }, []);

  const handleSelectEntry = useCallback(
    (entry: StudyEntry) => {
      setOverlay(null);
      router.push(`/entries/${entry.id}`);
    },
    [router],
  );

  const handlePickFromLabel = useCallback(
    (target: StudyTarget) => {
      // ラベル／ピルからの行き先は 3D の物を押したときと同じ。カメラの演出は経ずに
      // 直接移る（注釈は UI の側で、3D の当たりではない）。
      if (staysInStudy(target)) {
        setOverlay(overlayScope(target));
        return;
      }
      handleNavigate(target);
    },
    [handleNavigate],
  );

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 overflow-hidden"
      style={{
        opacity: leaveMs !== null ? 0 : entered ? 1 : 0,
        transition: `opacity ${leaveMs ?? DURATION.screenFade}ms ease-out`,
      }}
    >
      <StudyCanvas
        onLeaveStart={setLeaveMs}
        state={state}
        layout={layout}
        theme={theme}
        onNavigate={handleNavigate}
        onOpenOverlay={handleOpenOverlay}
        onLabelPositions={setLabelPositions}
        onHoverChange={(hovered) => {
          setHoveredLabel(hovered?.label ?? null);
          setHover(hovered);
        }}
      />

      {/* 一覧を開いている間はラベルを消す（サブ画面と遷移中も scene 側が消す）。 */}
      {overlay === null && (
        <StudyLabels
          layout={layout}
          positions={labelPositions}
          hovered={hoveredLabel}
          status={state.fermentation.status}
          readiness={state.fermentation.readiness}
          entryCount={currentMonthCount}
          volumeCount={archiveCount}
          cardCount={state.board.cards.length}
          screen={screen}
          onPick={handlePickFromLabel}
        />
      )}

      <StudyChrome
        status={state.fermentation.status}
        readiness={state.fermentation.readiness}
        initial={initialOf(auth?.user.nickname, auth?.user.email)}
        avatarUrl={auth?.user.avatarUrl}
        showCaption={showCaption && overlay === null}
      />

      {/* その冊に何が入っているかを、開く前に見せる。 */}
      {overlay === null && hover?.month && (
        <StudyTooltip
          month={hover.month}
          entryCount={
            state.notebooks.find((notebook) => notebook.month === hover.month)?.entryCount ?? 0
          }
          range={monthDateRange(
            state.entries.map((entry) => entry.createdAt),
            hover.month,
          )}
          current={hover.month === state.now.slice(0, 7)}
          screen={hover.screen}
        />
      )}

      <EntryListOverlay
        open={overlay !== null}
        entries={overlayEntries}
        loading={overlay?.month != null && monthLoading}
        months={months}
        selectedMonth={overlay?.month ?? null}
        onSelectMonth={(month) => setOverlay({ month })}
        onSelectEntry={handleSelectEntry}
        onClose={() => setOverlay(null)}
      />
    </div>
  );
}

/** 位置が届く前の初期値。 */
const EMPTY_LABELS: LabelPositions = { jar: null, journal: null, board: null, archive: null };

/** アバターに出す 1 文字。 */
function initialOf(nickname?: string | null, email?: string | null): string {
  return (nickname?.charAt(0) ?? email?.charAt(0) ?? '?').toUpperCase();
}
