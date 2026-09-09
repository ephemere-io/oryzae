'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HistoryDisc } from '@/features/pc/fermentation/components/history-disc';
import { useCoverFlowInput } from '@/features/pc/fermentation/hooks/use-cover-flow-input';
import {
  type DiscRect,
  discPlacement,
  ghostJarBox,
  hitTestStage,
  railWindow,
} from '@/features/pc/fermentation/utils/cover-flow-geometry';
import { toDateStamp } from '@/features/pc/fermentation/utils/history-labels';
import type { FermentationDetail, FermentationSummary } from '@/features/shared/fermentation/types';
import { useElementResize } from '@/lib/use-element-resize';

/** 操作ヒントを見たか。一度めくれば以後は出さない。 */
const HINT_SEEN_KEY = 'oryzae:jar-history-hint-seen';

/** 瓶のシルエット。jar-view と同じ 480×600 座標系のパス。 */
const JAR_PATH =
  'M190,100 C190,60 290,60 290,100 C290,130 270,140 270,170 C270,270 410,330 410,480 C410,580 70,580 70,480 C70,330 210,270 210,170 C210,140 190,130 190,100 Z';

/**
 * 円盤の下に添える期間ラベル。`target_period` が発酵日と同じ文字列の環境では、
 * 真上の日付スタンプと重複するので期間を落として `NEW` だけ残す。
 */
function discPeriodStamp(
  result: FermentationSummary,
  unreadIds: ReadonlySet<string>,
  t: (key: string) => string,
): string {
  const period = result.targetPeriod.startsWith(toDateStamp(result.createdAt))
    ? ''
    : result.targetPeriod;
  if (!unreadIds.has(result.id)) return period;
  return period ? `${period} · ${t('history.new')}` : t('history.new');
}

interface FermentationCoverFlowProps {
  /** 開いている問い。null なら履歴は閉じている。 */
  questionId: string | null;
  questionText: string;
  /** その問いの完了済み発酵（古い順・末尾が最新）。 */
  results: readonly FermentationSummary[];
  /** いま正面に出す段。 */
  index: number;
  /** 取得済みの詳細（id → 詳細）。 */
  details: ReadonlyMap<string, FermentationDetail>;
  unreadFermentationIds: ReadonlySet<string>;
  /** ユーザーが動かした中身の位置（瓶と共有する）。 */
  innerOverrides: {
    keywords: Record<string, { jarX: number; jarY: number }>;
    snippets: Record<string, { jarX: number; jarY: number }>;
    letters: Record<string, { jarX: number; jarY: number }>;
  };
  onInnerDragMove: (
    type: 'keyword' | 'snippet' | 'letter',
    id: string,
    x: number,
    y: number,
  ) => void;
  onInnerDragEnd: (
    type: 'keyword' | 'snippet' | 'letter',
    id: string,
    x: number,
    y: number,
  ) => void;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** 詳細ウィンドウが開いているか。開いている間は ESC を譲る（1 回目はあちらが閉じる）。 */
  paneOpen: boolean;
  onElementClick: (
    resultId: string,
    type: 'keyword' | 'snippet' | 'letter',
    id: string,
    data: Record<string, string>,
  ) => void;
  selectedElementId: string | null;
}

/**
 * 発酵履歴（Cover Flow）。ひとつの問いについて、過去の発酵を古い順に扇状へ並べてめくる。
 *
 * **瓶のキャンバス（CanvasViewport）の外側に敷く**。3D の perspective は変形した祖先の
 * 中では成立しないので、world ボックスの中に置くと円盤が平たく潰れる。位置と大きさは
 * この要素の実測サイズから出す（固定 px にしない）。
 */
export function FermentationCoverFlow({
  questionId,
  questionText,
  results,
  index,
  details,
  unreadFermentationIds,
  innerOverrides,
  onInnerDragMove,
  onInnerDragEnd,
  onIndexChange,
  onClose,
  paneOpen,
  onElementClick,
  selectedElementId,
}: FermentationCoverFlowProps) {
  const t = useTranslations('fermentation');
  const open = questionId !== null && results.length > 0;

  /** state で持つ（ref だと「後から現れた」ことに気づけず監視が張られない）。 */
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [canvas, setCanvas] = useState({ width: 1280, height: 800 });

  // 実測はマウント直後だと 0 やレイアウト前の値になることがある。400ms 後にもう一度測る
  // （サイドバーやフォントが落ち着いてからの寸法を採る）。
  //
  // 以後の追従は `useElementResize` に任せる。詳細列が開くとこの面は横に縮むが、
  // ウィンドウの大きさは変わらないので window の resize では気づけない（扇が縮んだ列の
  // 中央からずれたままになる）。
  const measure = useCallback(() => {
    const rect = rootEl?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    setCanvas((prev) =>
      prev.width === rect.width && prev.height === rect.height
        ? prev
        : { width: rect.width, height: rect.height },
    );
  }, [rootEl]);

  useEffect(() => {
    measure();
    const timer = setTimeout(measure, 400);
    return () => clearTimeout(timer);
  }, [measure]);

  useElementResize(rootEl, measure);

  /**
   * 操作ヒントを出すか。一度でもめくった人には二度と出さない。
   *
   * localStorage は初期値で読まない（SSR とハイドレーションで食い違う）。マウント後に
   * 一度だけ読む ── 詳細パネルの幅復元やキャンバスの視点保存と同じ流儀。
   */
  const [showHint, setShowHint] = useState(false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(HINT_SEEN_KEY) === null) setShowHint(true);
    } catch {
      // localStorage が使えない環境ではヒントを出さない（出せなくても操作はできる）。
    }
  }, []);

  const markHintSeen = useCallback(() => {
    setShowHint((prev) => {
      if (!prev) return prev;
      try {
        window.localStorage.setItem(HINT_SEEN_KEY, '1');
      } catch {
        // 覚えられなくても、この画面を開いている間は消える。
      }
      return false;
    });
  }, []);

  const clampedIndex = Math.min(Math.max(index, 0), Math.max(0, results.length - 1));

  const step = useCallback(
    (delta: number) => {
      const next = Math.min(results.length - 1, Math.max(0, clampedIndex + delta));
      if (next === clampedIndex) return;
      markHintSeen();
      onIndexChange(next);
    },
    [clampedIndex, results.length, onIndexChange, markHintSeen],
  );

  const { dragging, onWheel, onPointerDown, onPointerMove, onPointerUp } = useCoverFlowInput({
    active: open,
    onStep: step,
    onClose,
    closeOnEscape: !paneOpen,
  });

  /**
   * 円盤の中身（言葉・抜粋・手紙）を掴んだときは、ステージのめくりを始めない。
   *
   * 両方が同じ pointerdown を受けると、要素を動かしたつもりが同時に段まで送られる。
   * 掴む対象が要素かどうかは DOM を辿って決める（要素側で stopPropagation すると、
   * 今度はステージ背景のヒットテストまで止まってしまう）。
   */
  const isInnerElement = (target: EventTarget | null) =>
    target instanceof Element &&
    target.closest('[data-verify-unit="DraggableJarElement"]') !== null;

  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isInnerElement(e.target)) return;
    onPointerDown(e);
  };

  const ghost = ghostJarBox(canvas);
  const active = results[clampedIndex];
  const activeUnread = active ? unreadFermentationIds.has(active.id) : false;

  const placements = useMemo(
    () => results.map((_, i) => discPlacement(i - clampedIndex, canvas)),
    [results, clampedIndex, canvas],
  );

  /**
   * ステージの背景クリック。円盤は 3D で倒れているので、実測矩形を集めて
   * 4 段のヒットテストにかける（詳細は cover-flow-geometry）。
   */
  const handleStageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const stage = stageRef.current;
      if (!stage) return;
      const discs: DiscRect[] = [...stage.children].flatMap((el, i) => {
        if (!(el instanceof HTMLElement)) return [];
        const r = el.getBoundingClientRect();
        return [
          {
            index: i,
            left: r.left,
            top: r.top,
            width: r.width,
            height: r.height,
            zIndex: Number(el.style.zIndex || 0),
          },
        ];
      });
      const hit = hitTestStage({ x: e.clientX, y: e.clientY }, discs, clampedIndex);
      if (hit.kind === 'goTo') onIndexChange(hit.index);
      else if (hit.kind === 'close') onClose();
    },
    [clampedIndex, onIndexChange, onClose],
  );

  const activeDetail = active ? (details.get(active.id) ?? null) : null;
  const rail = railWindow(clampedIndex, results.length);

  return (
    <div
      ref={setRootEl}
      {...verifyAttrs({
        unit: 'FermentationCoverFlow',
        open,
        total: results.length,
        index: clampedIndex,
        dragging,
        hasActiveDetail: Boolean(activeDetail),
        unread: activeUnread,
      })}
      className="absolute inset-0"
      style={{ pointerEvents: open ? 'auto' : 'none' }}
    >
      {/* スクリム: 瓶のキャンバスを紙色で覆う。方眼だけ残して「同じ紙の上」を保つ。 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[20]"
        style={{
          background: 'var(--bg)',
          backgroundImage:
            'linear-gradient(rgba(140,133,126,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(140,133,126,0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          backgroundPosition: 'center center',
          opacity: open ? 1 : 0,
          transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />

      {/* ゴースト瓶: 「瓶の中を覗いている」文脈を残す。
          デザインシステムの瓶はガラス縁を白 0.8 で描くため紙色の上では消える。輪郭を足す。 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[30]"
        style={{
          opacity: open ? 0.78 : 0,
          transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '38%',
            width: `${ghost.width}px`,
            height: `${ghost.height}px`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <svg viewBox="0 0 480 600" fill="none" className="h-full w-full">
            <title>{t('history.ghost_jar_title')}</title>
            <path
              d={JAR_PATH}
              fill="rgba(226,194,142,0.06)"
              stroke="rgba(122,116,64,0.3)"
              strokeWidth="1.6"
            />
          </svg>
        </div>
      </div>

      {/* 円盤ステージ。奥行きはここで一度だけ作る。 */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: 円盤の取っ手は内側の QuestionCircle（role="button"）が持ち、めくりは ← → キーが受ける。ここは 3D の器兼「余白を押したときの行き先」を決める面で、role を足すと同じ操作に取っ手が二重にできる。 */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: 同上。キーボード操作は useCoverFlowInput が document で受ける。 */}
      <div
        ref={stageRef}
        onClick={handleStageClick}
        onWheel={onWheel}
        onPointerDown={handleStagePointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="absolute inset-0 z-[40]"
        style={{
          perspective: '1600px',
          perspectiveOrigin: '50% 36%',
          transformStyle: 'preserve-3d',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          touchAction: 'none',
          cursor: dragging ? 'grabbing' : 'default',
          transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {results.map((result, i) => (
          <HistoryDisc
            key={result.id}
            questionText={questionText}
            active={i === clampedIndex}
            adjacent={Math.abs(i - clampedIndex) === 1}
            placement={placements[i]}
            detail={details.get(result.id) ?? null}
            dateStamp={toDateStamp(result.createdAt)}
            periodStamp={discPeriodStamp(result, unreadFermentationIds, t)}
            unread={unreadFermentationIds.has(result.id)}
            dragging={dragging}
            innerOverrides={innerOverrides}
            onInnerDragMove={onInnerDragMove}
            onInnerDragEnd={onInnerDragEnd}
            onActivate={i === clampedIndex ? undefined : () => onIndexChange(i)}
            onElementClick={(type, id, data) => onElementClick(result.id, type, id, data)}
            selectedElementId={selectedElementId}
          />
        ))}
      </div>

      {open && (
        <>
          {/* 左上: 瓶にもどる */}
          <div className="absolute top-6 left-7 z-[70]">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-2 rounded-full border border-[var(--border-subtle)] px-4 py-[7px] pl-3 text-[10px] tracking-[0.2em] text-[var(--date-color)] transition-colors hover:bg-[rgba(140,133,126,0.1)] hover:text-[var(--fg)]"
              style={{
                background: 'rgba(253,251,247,0.4)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                fontFamily: "'Noto Sans JP', sans-serif",
              }}
            >
              <span className="text-[13px] leading-none">‹</span>
              {t('history.back_to_jar')}
            </button>
          </div>

          {/* 上中央: 問いだけ。
              「NN / NN」は日付レールが位置そのものを見せているので出さない。 */}
          <div className="pointer-events-none absolute top-6 left-1/2 z-[70] flex -translate-x-1/2 flex-col items-center">
            <span
              className="text-[15px] tracking-[0.06em] text-[var(--fg)]"
              style={{ fontFamily: "'Noto Serif JP', serif" }}
            >
              {questionText}
            </span>
          </div>

          {/*
            下中央は **日付レール一本**。
            以前はこの上に「2026年08月27日の発酵（最新）」と「WEEK 35 · 2 ENTRIES SCANNED」を
            重ねていたが、日付も順序もレールが見せている内容の言い換えでしかなかった。
            走査件数は読む前に要る数字ではないので、もとの記録を並べている詳細側へ譲る。
          */}
          {/* 器の幅を列に合わせて閉じ込める。中身がどれだけ増えても外へ出さない。 */}
          <div className="absolute right-0 bottom-[90px] left-0 z-[70] flex flex-col items-center gap-3.5 px-8">
            {/* 日付レール: 任意の段へ飛ぶ。
                列からはみ出さないよう、いま見ている段を中央に置いた窓だけを並べる。 */}
            <div className="flex max-w-full items-center gap-1 overflow-hidden">
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label={t('history.prev_aria')}
                disabled={clampedIndex === 0}
                className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-sm text-[var(--date-color)] transition-colors hover:bg-[rgba(140,133,126,0.1)] disabled:opacity-30"
              >
                ‹
              </button>
              {rail.hasBefore && (
                <span
                  data-verify-part="rail-more"
                  aria-hidden="true"
                  className="px-1 text-[10px] tracking-[0.1em] text-[var(--date-color)] opacity-60"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  …
                </span>
              )}
              {results.slice(rail.start, rail.end).map((result, offsetInWindow) => {
                const i = rail.start + offsetInWindow;
                const isActive = i === clampedIndex;
                const isUnread = unreadFermentationIds.has(result.id);
                // 「最新」は末尾の段だけ。窓が手前で切れている間は出ない。
                const isNewest = i === results.length - 1;
                const stamp = toDateStamp(result.createdAt);
                return (
                  <button
                    key={result.id}
                    type="button"
                    data-verify-part="rail-item"
                    data-verify-rail-active={isActive}
                    onClick={() => {
                      markHintSeen();
                      onIndexChange(i);
                    }}
                    className={`flex items-baseline gap-1.5 whitespace-nowrap rounded-full transition-all ${
                      isActive
                        ? 'px-4 py-1.5'
                        : 'px-[11px] py-[5px] hover:bg-[rgba(140,133,126,0.08)]'
                    }`}
                    style={{
                      background: isActive ? 'rgba(74,158,142,0.1)' : 'transparent',
                      color: isActive
                        ? 'var(--accent)'
                        : isUnread
                          ? 'var(--ob-jar-warm)'
                          : 'var(--date-color)',
                    }}
                  >
                    <span
                      style={
                        isActive
                          ? {
                              fontFamily: "'Noto Serif JP', serif",
                              fontSize: 14,
                              letterSpacing: '0.06em',
                            }
                          : {
                              fontFamily: 'Inter, sans-serif',
                              fontSize: 9,
                              letterSpacing: '0.18em',
                            }
                      }
                    >
                      {/* 選ばれていない段は月日だけ。年は選択中のチップが持っているので、
                          50 件並んでもレールが横に伸びきらない。 */}
                      {isActive ? stamp : stamp.slice(5)}
                    </span>
                    {isNewest && (
                      <span
                        className="uppercase tracking-[0.2em] opacity-70"
                        style={{ fontFamily: 'Inter, sans-serif', fontSize: 8 }}
                      >
                        {t('history.newest')}
                      </span>
                    )}
                  </button>
                );
              })}
              {rail.hasAfter && (
                <span
                  data-verify-part="rail-more"
                  aria-hidden="true"
                  className="px-1 text-[10px] tracking-[0.1em] text-[var(--date-color)] opacity-60"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  …
                </span>
              )}
              <button
                type="button"
                onClick={() => step(1)}
                aria-label={t('history.next_aria')}
                disabled={clampedIndex === results.length - 1}
                className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-sm text-[var(--date-color)] transition-colors hover:bg-[rgba(140,133,126,0.1)] disabled:opacity-30"
              >
                ›
              </button>
            </div>

            {/* 操作ヒントは **初めて開いたときだけ**。扇の形とレールの矢印で見えている
                ことを、毎回文章で言い直す必要はない。1 段めくれば役目は終わる。 */}
            <span
              data-verify-part="hint"
              className="text-[9px] tracking-[0.24em] text-[var(--date-color)]"
              style={{
                fontFamily: "'Noto Sans JP', sans-serif",
                opacity: showHint ? 0.85 : 0,
                transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              {t('history.hint')}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
