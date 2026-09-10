'use client';

// verify-exempt: router / データ取得 / three.js の dynamic import を束ねるページ級の合成。
// 中身の部品（StudyChrome / EntryListOverlay / StudyFallback）が個別に検証されている。

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEntries } from '@/features/shared/entries/hooks/use-entries';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { readStudyBackdrop, saveStudyBackdrop } from '../backdrop';
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
import { StudyHintTooltip } from './study-hint-tooltip';
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
}

export function StudyHome({ layout }: StudyHomeProps) {
  const router = useRouter();
  const { api, auth, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const { state } = useStudyState(api, authLoading, auth?.user.id ?? null);

  // 一覧オーバーレイは書斎の中で開く（URL は変わらない）。
  const [overlay, setOverlay] = useState<{ month: string | null } | null>(null);

  // 一覧の絞り込み。開いている間だけ持つ（閉じれば次に開いたときは素の状態から）。
  const [listSearch, setListSearch] = useState('');
  const [listQuestionId, setListQuestionId] = useState<string | null>(null);

  /**
   * 一覧が出す記録。**開いている間だけ**取りに行く（`api` を渡さなければ取得は起きない）。
   *
   * `state.entries` を使い回さないのは、あれが直近 20 件しか持たないため（一覧のためでは
   * なく、手帳のホバーに出す日付の範囲を作るためのもの）。手元で月に絞ると、20 件より
   * 古い月が必ず空になる。月・問い・検索の絞り込みも、続きの読み込みもサーバーに任せる。
   */
  const list = useEntries(
    overlay === null ? null : api,
    listSearch.trim() === '' ? undefined : listSearch.trim(),
    listQuestionId ?? undefined,
    'newest',
    overlay?.month ?? undefined,
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
  /**
   * 戻り道に敷く「憶えた部屋」と、canvas が最初の 1 フレームを描いたか。
   *
   * **絵を外してよいのは canvas が実際に描いたあと。** 以前は three.js の読み込みが
   * 終わった時点で絵ごと差し替えていたので、canvas が 1 フレーム目を描くまでの間に
   * 地の色だけが見え、戻るたびに画面が点滅していた（実機レビュー）。
   */
  const [backdrop, setBackdrop] = useState<string | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);

  useEffect(() => setBackdrop(readStudyBackdrop()), []);

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

  /** 一覧に出す行。開くまでは取りに行っていないので、その間は手元の直近ぶんを出す。 */
  const overlayEntries = useMemo(
    () => (overlay === null ? state.entries : list.entries.map(toStudyEntry)),
    [overlay, list.entries, state.entries],
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
    <div ref={rootRef} className="absolute inset-0 overflow-hidden">
      {/* 憶えた部屋。**溶暗の外側に置く。** 中に入れると、書斎が opacity 0 から
          現れるあいだ地まで一緒に薄くなり、そこで点滅が起きる。canvas が最初の
          1 フレームを描いたら消す。 */}
      {backdrop === null ? null : (
        // biome-ignore lint/performance/noImgElement: data URL の地。最適化する先が無い
        <img
          src={backdrop}
          alt=""
          aria-hidden="true"
          data-study-backdrop
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            opacity: canvasReady ? 0 : 1,
            transition: `opacity ${BACKDROP_FADE_MS}ms ease-out`,
          }}
        />
      )}

      <div
        className="absolute inset-0"
        style={{
          /**
           * **地を敷いているあいだは、溶暗で入らない。**
           *
           * 入りの溶暗（0 → 1）は「サブ画面から戻ったときに書斎が唐突に現れない」ため
           * のものだが、憶えた部屋を敷いているなら**部屋はもう出ている**。両方を同時に
           * 走らせると、canvas がまだ薄いうちに地が引いて画面が一度白茶け、それが
           * 点滅に見えていた（実機レビュー）。地があるときは等倍で置き、地のほうだけを
           * 引かせる。
           */
          opacity: leaveMs !== null ? 0 : entered || backdrop !== null ? 1 : 0,
          transition: `opacity ${leaveMs ?? DURATION.screenFade}ms ease-out`,
        }}
      >
        <StudyCanvas
          onLeaveStart={setLeaveMs}
          onReady={() => setCanvasReady(true)}
          // 出ていく直前の 1 枚を憶える。戻り道はこれを地にして、部屋が「消えた」のでは
          // なく「遠くなった」だけに見えるようにする。
          onCapture={saveStudyBackdrop}
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
            cardCount={state.board.total}
            screen={screen}
            onPick={handlePickFromLabel}
          />
        )}

        <StudyChrome
          initial={initialOf(auth?.user.nickname, auth?.user.email)}
          avatarUrl={auth?.user.avatarUrl}
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

        {/* 鉛筆に触れたとき、押すと何が起きるかを一言で見せる。鉛筆はラベルを持たない
          （積みの JOURNAL と重なるため）ので、これが唯一の予告になる。 */}
        {overlay === null && hover?.hint === 'pen' && (
          <StudyHintTooltip textKey="hint_pen" screen={hover.screen} />
        )}

        <EntryListOverlay
          open={overlay !== null}
          entries={overlayEntries}
          loading={list.loading && list.entries.length === 0}
          hasMore={list.hasMore}
          onLoadMore={list.loadMore}
          search={listSearch}
          onSearchChange={setListSearch}
          questions={state.questions}
          questionId={listQuestionId}
          onSelectQuestion={setListQuestionId}
          months={months}
          selectedMonth={overlay?.month ?? null}
          onSelectMonth={(month) => setOverlay({ month })}
          onSelectEntry={handleSelectEntry}
          onClose={() => {
            setOverlay(null);
            // 次に開いたときは素の状態から。絞ったまま閉じると、別の月を開いても
            // 前の検索語が効いていて「記録が無い」ように見える。
            setListSearch('');
            setListQuestionId(null);
          }}
        />
      </div>
    </div>
  );
}

/** 憶えた部屋を消すのにかける時間（ms）。canvas が描いたあと、静かに引く。 */
const BACKDROP_FADE_MS = 320;

/** 位置が届く前の初期値。 */
const EMPTY_LABELS: LabelPositions = { jar: null, journal: null, board: null, archive: null };

/** アバターに出す 1 文字。 */
function initialOf(nickname?: string | null, email?: string | null): string {
  return (nickname?.charAt(0) ?? email?.charAt(0) ?? '?').toUpperCase();
}
