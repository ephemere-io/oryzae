'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { type DockDetent, DockSheet } from '@/components/ui/dock-sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { CONTROL_FONT } from '@/components/ui/surface';
import { FermentationReading } from '@/features/shared/fermentation/components/fermentation-reading';
import type { FermentationDetail } from '@/features/shared/fermentation/types';
import { formatMonthDay } from '@/lib/format-date';

/** 結果を見る問い（エントリーに結んでいるもの）。 */
export interface DockQuestion {
  id: string;
  text: string;
}

/** その問いのこれまでの発酵（新しい順）。 */
export interface DockRound {
  id: string;
  createdAt: string;
}

interface SpFermentationDockProps {
  open: boolean;
  detent: DockDetent;
  onDetentChange: (detent: DockDetent) => void;
  /** 覗く段を押したとき（本文からフォーカスを外す）。 */
  onPeekTap?: () => void;
  /** エントリーに結んでいる問い。0 件なら「問いを結ぶと出る」と言う。 */
  questions: readonly DockQuestion[];
  /** 見ている問い。 */
  questionId: string | null;
  onQuestionChange: (questionId: string) => void;
  /** 見ている問いのこれまでの発酵（新しい順）。 */
  rounds: readonly DockRound[];
  /** 見ている回。 */
  roundId: string | null;
  onRoundChange: (roundId: string) => void;
  detail: FermentationDetail | null;
  loading: boolean;
  /** 問いを結ぶ（問いが無いときの入口）。 */
  onLinkQuestion: () => void;
}

/**
 * 発酵の結果を**見ながら書く**ためのドック（SP）。
 *
 * PC では手紙・言葉・抜粋が本文の横に居て、目だけが行き来する。スマホには横が無いので、往復は上下で
 * 作る: 本文の下に非モーダルの `DockSheet`（覗く／半分／全画面）。
 *
 * - **いちばん上で「どの問いの」「いつの」結果かを選ぶ**。結んだ問いが複数なら問いを、その問いの発酵が
 *   複数回なら日付を。以前は最初の問いの最新の 1 回しか見られず、日付は抜粋ごとに並んでいた（レビュー）
 * - 覗く段は問いと日付の 1 行。「発酵の結果」という見出しは出さない（パレットの名前と同じことを 2 度
 *   言っていた）
 * - 問いを結ぶ前から出す。結ぶと何が出るかをここで言い、結ぶ入口を置く（パレットにあるのに押しても
 *   何も出ない、をやめた）
 * - 中身は瓶の問いの画面と同じ `FermentationReading`（書きながら見渡すので最初から全部）
 */
export function SpFermentationDock({
  open,
  detent,
  onDetentChange,
  onPeekTap,
  questions,
  questionId,
  onQuestionChange,
  rounds,
  roundId,
  onRoundChange,
  detail,
  loading,
  onLinkQuestion,
}: SpFermentationDockProps) {
  const t = useTranslations('sp.editor');
  const tSidebar = useTranslations('editor.fermentation_sidebar');

  const question = questions.find((item) => item.id === questionId) ?? null;
  const round = rounds.find((item) => item.id === roundId) ?? null;
  const keywords = detail?.keywords ?? [];
  const snippets = detail?.snippets ?? [];
  const letter = detail?.letter?.bodyText ?? null;
  const state: 'no-question' | 'loading' | 'not-fermented' | 'ready' = !question
    ? 'no-question'
    : loading
      ? 'loading'
      : detail === null || (keywords.length === 0 && snippets.length === 0 && letter === null)
        ? 'not-fermented'
        : 'ready';

  return (
    <DockSheet
      open={open}
      detent={detent}
      onDetentChange={onDetentChange}
      onPeekTap={onPeekTap}
      ariaLabel={tSidebar('heading')}
      contract={verifyAttrs({
        unit: 'SpFermentationDock',
        detent,
        state,
        questionCount: questions.length,
        roundCount: rounds.length,
        keywordCount: keywords.length,
        snippetCount: snippets.length,
        hasLetter: letter !== null,
      })}
      peek={
        <span className="flex w-full min-w-0 items-center gap-3" style={CONTROL_FONT}>
          {question ? (
            <>
              <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: 'var(--fg)' }}>
                {question.text}
              </span>
              {round ? (
                <span className="shrink-0 text-[11px]" style={{ color: 'var(--date-color)' }}>
                  {formatMonthDay(round.createdAt)}
                </span>
              ) : null}
            </>
          ) : (
            <span
              className="min-w-0 flex-1 truncate text-[13px]"
              style={{ color: 'var(--date-color)' }}
            >
              {t('result_no_question')}
            </span>
          )}
        </span>
      }
    >
      <div className="flex flex-col gap-4 pt-1">
        {/* どの問いの結果か（結んだ問いが複数のとき）。 */}
        {questions.length > 1 ? (
          <Chips ariaLabel={t('result_question_aria')}>
            {questions.map((item) => (
              <Chip
                key={item.id}
                active={item.id === questionId}
                onClick={() => onQuestionChange(item.id)}
                data-result-question={item.id}
              >
                {item.text}
              </Chip>
            ))}
          </Chips>
        ) : null}

        {/* いつの結果か（その問いの発酵が複数回のとき）。 */}
        {question && rounds.length > 1 ? (
          <Chips ariaLabel={t('result_round_aria')}>
            {rounds.map((item, index) => (
              <Chip
                key={item.id}
                active={item.id === roundId}
                onClick={() => onRoundChange(item.id)}
                data-result-round={item.id}
              >
                {index === 0 ? `${t('result_latest')} · ` : ''}
                {formatMonthDay(item.createdAt)}
              </Chip>
            ))}
          </Chips>
        ) : null}

        {state === 'no-question' ? (
          <div className="flex flex-col items-start gap-3" style={CONTROL_FONT}>
            <p className="m-0 text-[13px] leading-relaxed" style={{ color: 'var(--date-color)' }}>
              {t('result_no_question_body')}
            </p>
            <button
              type="button"
              data-result-link-question
              onClick={onLinkQuestion}
              className="min-h-[40px] rounded-full px-4 text-[13px] font-medium"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}
            >
              {t('question_link')}
            </button>
          </div>
        ) : state === 'loading' ? (
          <div className="flex flex-col gap-3 pt-1">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ) : state === 'not-fermented' ? (
          <p className="m-0 text-[13px]" style={{ ...CONTROL_FONT, color: 'var(--date-color)' }}>
            {t('result_not_fermented')}
          </p>
        ) : detail ? (
          // 日付は上で回ごとに選ぶので、抜粋ごとには出さない。
          <FermentationReading detail={detail} sourceDates={false} />
        ) : null}
      </div>
    </DockSheet>
  );
}

function Chips({ ariaLabel, children }: { ariaLabel: string; children: React.ReactNode }) {
  return (
    <fieldset aria-label={ariaLabel} className="m-0 min-w-0 border-0 p-0">
      <div
        className="-mx-5 flex gap-2 overflow-x-auto px-5"
        style={{ ...CONTROL_FONT, scrollbarWidth: 'none' }}
      >
        {children}
      </div>
    </fieldset>
  );
}

function Chip({
  active,
  onClick,
  children,
  ...data
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  [key: `data-${string}`]: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      {...data}
      className="max-w-[16rem] shrink-0 truncate rounded-full border px-3 py-1.5 text-[12px]"
      style={{
        borderColor: active ? 'var(--accent)' : 'var(--border-subtle)',
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? 'var(--bg)' : 'var(--fg)',
      }}
    >
      {children}
    </button>
  );
}
