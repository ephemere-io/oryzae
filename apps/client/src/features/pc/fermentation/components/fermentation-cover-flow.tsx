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
  maxOffsetFrom,
} from '@/features/pc/fermentation/utils/cover-flow-geometry';
import { pad2, toDateStamp, toJapaneseDate } from '@/features/pc/fermentation/utils/history-labels';
import type { FermentationDetail, FermentationSummary } from '@/features/shared/fermentation/types';

/** 瓶のシルエット。jar-view と同じ 480×600 座標系のパス。 */
const JAR_PATH =
  'M190,100 C190,60 290,60 290,100 C290,130 270,140 270,170 C270,270 410,330 410,480 C410,580 70,580 70,480 C70,330 210,270 210,170 C210,140 190,130 190,100 Z';

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
  onIndexChange: (index: number) => void;
  onClose: () => void;
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
  onIndexChange,
  onClose,
  onElementClick,
  selectedElementId,
}: FermentationCoverFlowProps) {
  const t = useTranslations('fermentation');
  const open = questionId !== null && results.length > 0;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [canvas, setCanvas] = useState({ width: 1280, height: 800 });

  // 実測はマウント直後だと 0 やレイアウト前の値になることがある。resize に加えて
  // 400ms 後にもう一度測る（サイドバーやフォントが落ち着いてからの寸法を採る）。
  useEffect(() => {
    const measure = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return;
      setCanvas((prev) =>
        prev.width === rect.width && prev.height === rect.height
          ? prev
          : { width: rect.width, height: rect.height },
      );
    };
    measure();
    const timer = setTimeout(measure, 400);
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', measure);
    };
  }, []);

  const clampedIndex = Math.min(Math.max(index, 0), Math.max(0, results.length - 1));

  const step = useCallback(
    (delta: number) => {
      const next = Math.min(results.length - 1, Math.max(0, clampedIndex + delta));
      if (next !== clampedIndex) onIndexChange(next);
    },
    [clampedIndex, results.length, onIndexChange],
  );

  const { dragging, onWheel, onPointerDown, onPointerMove, onPointerUp } = useCoverFlowInput({
    active: open,
    onStep: step,
    onClose,
  });

  const maxOffset = maxOffsetFrom(clampedIndex, results.length);
  const ghost = ghostJarBox(canvas);
  const active = results[clampedIndex];
  const activeUnread = active ? unreadFermentationIds.has(active.id) : false;

  const placements = useMemo(
    () => results.map((_, i) => discPlacement(i - clampedIndex, maxOffset, canvas)),
    [results, clampedIndex, maxOffset, canvas],
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

  const dateStamp = active ? toDateStamp(active.createdAt) : '';
  const stepsBack = results.length - 1 - clampedIndex;
  const activeDetail = active ? (details.get(active.id) ?? null) : null;
  const scanned = activeDetail?.scannedEntries.length ?? 0;

  return (
    <div
      ref={rootRef}
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
        onPointerDown={onPointerDown}
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
            periodStamp={
              unreadFermentationIds.has(result.id)
                ? `${result.targetPeriod} · ${t('history.new')}`
                : result.targetPeriod
            }
            unread={unreadFermentationIds.has(result.id)}
            dragging={dragging}
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

          {/* 上中央: 問いと進捗 */}
          <div className="pointer-events-none absolute top-6 left-1/2 z-[70] flex -translate-x-1/2 flex-col items-center gap-[7px]">
            <span
              className="text-[15px] tracking-[0.06em] text-[var(--fg)]"
              style={{ fontFamily: "'Noto Serif JP', serif" }}
            >
              {questionText}
            </span>
            <span
              className="text-[9px] uppercase tracking-[0.32em] text-[var(--date-color)]"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              {t('history.progress', {
                current: pad2(clampedIndex + 1),
                total: pad2(results.length),
              })}
            </span>
          </div>

          {/* 下中央: 日付・期間・レール・操作ヒント */}
          <div className="absolute bottom-[90px] left-1/2 z-[70] flex -translate-x-1/2 flex-col items-center gap-3.5">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className="text-sm tracking-[0.04em] text-[var(--fg)]"
                style={{ fontFamily: "'Noto Serif JP', serif" }}
              >
                {stepsBack === 0
                  ? t('history.date_line_latest', { date: toJapaneseDate(dateStamp) })
                  : t('history.date_line_back', {
                      date: toJapaneseDate(dateStamp),
                      steps: stepsBack,
                    })}
              </span>
              <span
                className="text-[9px] uppercase tracking-[0.28em] text-[var(--date-color)]"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                {[
                  active?.targetPeriod,
                  // 詳細が届くまでは件数を出さない（0 ENTRIES と嘘をつかない）。
                  activeDetail ? t('history.entries_scanned', { count: scanned }) : null,
                  activeUnread ? t('history.new') : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>

            {/* 日付レール: 任意の段へ飛ぶ */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label={t('history.prev_aria')}
                disabled={clampedIndex === 0}
                className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-sm text-[var(--date-color)] transition-colors hover:bg-[rgba(140,133,126,0.1)] disabled:opacity-30"
              >
                ‹
              </button>
              {results.map((result, i) => {
                const isActive = i === clampedIndex;
                const isUnread = unreadFermentationIds.has(result.id);
                return (
                  <button
                    key={result.id}
                    type="button"
                    data-verify-part="rail-item"
                    onClick={() => onIndexChange(i)}
                    className="whitespace-nowrap rounded-full px-[11px] py-[5px] text-[9px] tracking-[0.18em] transition-colors"
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      background: isActive ? 'rgba(74,158,142,0.1)' : 'transparent',
                      color: isActive
                        ? 'var(--accent)'
                        : isUnread
                          ? 'var(--ob-jar-warm)'
                          : 'var(--date-color)',
                    }}
                  >
                    {toDateStamp(result.createdAt)}
                  </button>
                );
              })}
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

            <span
              className="text-[9px] tracking-[0.24em] text-[var(--date-color)] opacity-85"
              style={{ fontFamily: "'Noto Sans JP', sans-serif" }}
            >
              {t('history.hint')}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
