'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import { Select } from '@/components/ui/select';
import { CONTROL_FONT, ICON_STROKE_WIDTH } from '@/components/ui/surface';
import { useEscapeKey } from '@/lib/use-escape-key';
import { spineLabelText } from '../scene/books';
import type { StudyEntry } from '../types';

export interface EntryListOverlayProps {
  open: boolean;
  entries: StudyEntry[];
  /** 選べる月（新しい順）。`ALL` は常に先頭に出る。 */
  months: string[];
  /**
   * 絞り込み中の月。`null` は全月。**見出しと選択肢の表示にだけ使う。**
   *
   * 行の絞り込みはここでは行わない。呼び出し側が既にその月ぶんを渡している
   * （サーバーが利用者のローカル暦月で絞る）。ここで `createdAt` の頭 7 文字を見て
   * もう一度絞ると、**UTC の月**で判定することになり、JST の月初 00:00〜09:00 に
   * 書いた記録を前月扱いで落としてしまう。
   */
  selectedMonth: string | null;
  /**
   * 記録を取りに行っている最中か。
   *
   * これが無いと、取得中に「この月の記録はありません」が出てから行が現れる。
   * 手帳の厚みが件数を言っているぶん、0 件の断定はとくに嘘っぽく見える。
   */
  loading?: boolean;
  /** まだ続きがあるか。ALL は直近から順に取るので、古い記録はここから辿る。 */
  hasMore?: boolean;
  onLoadMore?: () => void;
  /** 本文の検索語。空なら絞らない。 */
  search?: string;
  onSearchChange?: (value: string) => void;
  /** 絞り込みに出す問い。 */
  questions?: { id: string; currentText: string | null }[];
  /** 絞り込み中の問い。`null` は全部。 */
  questionId?: string | null;
  onSelectQuestion?: (questionId: string | null) => void;
  onSelectMonth: (month: string | null) => void;
  onSelectEntry: (entry: StudyEntry) => void;
  /**
   * 「新規作成」。一覧から新しく書き始める。
   *
   * 当月の手帳を押すと一覧が開くようになったので、書く入口をここにも置く
   * （鉛筆を押せば直接書き始められるのは変わらない）。
   */
  onCreateEntry?: () => void;
  onClose: () => void;
  /**
   * 見せ方。`paper`（既定）は机にかぶさる紙、`mobile` は全画面の一覧。
   * どちらにするかは構図（`StudyLayout.listPresentation`）が決め、ここでは端末を見ない。
   */
  variant?: 'paper' | 'mobile';
}

/**
 * `2026-09-02T…` → `09.02`。行の先頭に置く日付。
 *
 * **利用者のローカル暦日で出す。** `createdAt` は UTC 保存なので、文字列を切ると
 * JST の 09:00 より前に書いた記録が前日として並ぶ。月で絞った一覧では、6 月の一覧に
 * `05.31` の行が混じって見えることになる（月の切り方はサーバー側でローカル暦月）。
 */
export function formatRowDate(createdAt: string): string {
  const at = new Date(createdAt);
  if (Number.isNaN(at.getTime())) {
    // 壊れた日付。切り出せるところまでで出す（行そのものは落とさない）。
    return createdAt.slice(0, 10);
  }
  const month = `${at.getMonth() + 1}`.padStart(2, '0');
  const day = `${at.getDate()}`.padStart(2, '0');
  return `${month}.${day}`;
}

/** 選択肢の「すべて」を表す値。id と衝突しない記号にする。 */
const ALL = '__all__';

/**
 * 手帳を開いた上にかぶさる一覧（`docs/oryzae-study/00-overview.md`「エントリー一覧の扱い」）。
 *
 * 独立した画面ではなく**書斎の中のオーバーレイ**。`/entries` へ飛ばさないのは、
 * そうすると既存の一覧画面を作り替えることになるため（60-implementation-notes.md §4）。
 *
 * 見せ方は 2 つ:
 * - `paper`: 机の上の紙（幅 720px）。月と問いはチップで一覧でき、一目で切り替えられる
 * - `mobile`: 全画面。月と問いは**ドロップダウンに畳む**。狭い画面では選択肢を並べる
 *   場所より本文を読む場所に幅を使う（PC の紙をそのまま縮めた版は「PC のレスポンシブ」
 *   と言われた）。上段は左に閉じる、右に新規作成の正円（SP の他の画面と同じ骨格）
 */
export function EntryListOverlay({
  open,
  entries,
  months,
  selectedMonth,
  loading = false,
  hasMore = false,
  onLoadMore,
  search = '',
  onSearchChange,
  questions = [],
  questionId = null,
  onSelectQuestion,
  onSelectMonth,
  onSelectEntry,
  onCreateEntry,
  onClose,
  variant = 'paper',
}: EntryListOverlayProps) {
  const t = useTranslations('study');
  useEscapeKey(open, onClose);

  /**
   * 外側（紙の外）を押したら閉じる。**押し始めも外だったときだけ。**
   *
   * click の的だけを見ると、検索欄で文字を選んで紙の外で指を離したときにも
   * 閉じてしまう（その click は共通の祖先＝外側に届く）。押し始めた場所を憶えておく。
   */
  const pressedOutside = useRef(false);

  if (!open) return null;

  const contract = verifyAttrs({
    unit: 'EntryListOverlay',
    variant,
    selectedMonth: selectedMonth ?? 'all',
    rowCount: entries.length,
    monthCount: months.length,
    loading,
    hasMore,
    questionId: questionId ?? 'all',
    searching: search.length > 0,
    canCreate: onCreateEntry !== undefined,
  });

  const rows = loading ? (
    // 取りに行っている間は 0 件だと断定しない。
    <p className="py-10 text-center text-[12px]" style={{ color: '#8C857E' }}>
      {t('list_loading')}
    </p>
  ) : entries.length === 0 ? (
    // 空の行を並べるのではなく、無いと言う。
    <p className="py-10 text-center text-[12px]" style={{ color: '#8C857E' }}>
      {t('list_empty_month')}
    </p>
  ) : (
    <ul className="flex flex-col">
      {entries.map((entry) => (
        <li key={entry.id}>
          {variant === 'mobile' ? (
            <MobileRow entry={entry} onClick={() => onSelectEntry(entry)} />
          ) : (
            <PaperRow entry={entry} onClick={() => onSelectEntry(entry)} />
          )}
        </li>
      ))}
    </ul>
  );

  const loadMore =
    hasMore && onLoadMore && !loading ? (
      // ALL は直近から順に取る。ここを押さないと古い記録に辿り着けない。
      <button
        type="button"
        onClick={onLoadMore}
        className="mt-4 w-full rounded-lg py-3 text-center text-[12px] transition-colors hover:bg-[rgba(140,133,126,0.08)]"
        style={{ color: '#8C857E', border: '1px solid rgba(122,116,64,0.14)' }}
      >
        {t('list_load_more')}
      </button>
    ) : null;

  if (variant === 'mobile') {
    const title =
      selectedMonth === null
        ? t('tooltip_entries', { count: entries.length })
        : `${spineLabelText(selectedMonth)}${loading ? '' : ` · ${t('tooltip_entries', { count: entries.length })}`}`;
    return (
      <div
        {...contract}
        className="absolute inset-0 z-20 flex flex-col"
        style={{ background: 'var(--bg)', color: 'var(--fg)' }}
      >
        {/* 上段: 左に閉じる、右に新規作成（SP の他の画面と同じ正円）。 */}
        <div
          className="flex shrink-0 items-center gap-2 px-2"
          style={{
            ...CONTROL_FONT,
            height: 'calc(48px + env(safe-area-inset-top, 0px))',
            paddingTop: 'env(safe-area-inset-top, 0px)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label={t('list_close')}
            className={ROUND_BUTTON_CLASS}
            style={ROUND_BUTTON_STYLE}
          >
            <CloseIcon />
          </button>
          <h2 className="m-0 min-w-0 flex-1 truncate text-center text-[13px] font-medium">
            {title}
          </h2>
          {onCreateEntry ? (
            <button
              type="button"
              onClick={onCreateEntry}
              aria-label={t('list_new_entry')}
              data-verify-part="create-entry"
              className={ROUND_BUTTON_CLASS}
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              <PlusIcon />
            </button>
          ) : (
            <span aria-hidden="true" className="h-11 w-11 shrink-0" />
          )}
        </div>

        {/* 絞り込み: 月と問いはドロップダウンに畳む（一覧に並べない）。1 行に収める。 */}
        <div className="flex shrink-0 flex-col gap-2 px-4 pt-1 pb-3">
          <div className="flex gap-2" data-filter-group>
            <Select
              value={selectedMonth ?? ALL}
              options={[
                { value: ALL, label: t('filter_all_months') },
                ...months.map((month) => ({ value: month, label: spineLabelText(month) })),
              ]}
              onChange={(value) => onSelectMonth(value === ALL ? null : value)}
              ariaLabel={t('filter_month_aria')}
              className="min-w-0 flex-1"
            />
            {onSelectQuestion && questions.length > 0 ? (
              <Select
                value={questionId ?? ALL}
                options={[
                  { value: ALL, label: t('chip_all_questions') },
                  ...questions.map((question) => ({
                    value: question.id,
                    label: question.currentText ?? t('question_untitled'),
                  })),
                ]}
                onChange={(value) => onSelectQuestion(value === ALL ? null : value)}
                ariaLabel={t('filter_question_aria')}
                className="min-w-0 flex-1"
              />
            ) : null}
          </div>
          {onSearchChange ? (
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={t('list_search_placeholder')}
              aria-label={t('list_search_placeholder')}
              // 16px 未満の入力欄に触れると iOS が画面ごと拡大する。
              className="w-full rounded-lg px-3 py-2 text-[16px] outline-none"
              style={{
                background: 'var(--surface-sunken)',
                border: '1px solid var(--surface-sunken-border)',
                color: 'var(--fg)',
              }}
            />
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 pb-10">
          {rows}
          {loadMore}
        </div>
      </div>
    );
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: 外側を押して閉じるのは補助で、閉じる操作そのものは ✕ ボタンと Esc が担う
    // biome-ignore lint/a11y/useKeyWithClickEvents: キーボードでは Esc で閉じる（useEscapeKey）
    <div
      {...contract}
      className="absolute inset-0 z-20 flex items-start justify-center overflow-auto px-6 py-14"
      onPointerDown={(event) => {
        pressedOutside.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (pressedOutside.current && event.target === event.currentTarget) onClose();
        pressedOutside.current = false;
      }}
    >
      <div
        className="w-full max-w-[720px] rounded-xl p-6"
        style={{
          background: '#fdfbf7',
          border: '1px solid rgba(122,116,64,0.18)',
          boxShadow: '0 12px 48px rgba(140,133,126,0.18)',
        }}
      >
        <div className="mb-5 flex items-center gap-2">
          <h2
            className="min-w-0 flex-1 truncate text-[10px] font-medium uppercase tracking-[0.2em]"
            style={{ color: '#8C857E', fontFamily: 'Inter, sans-serif' }}
          >
            {selectedMonth === null
              ? t('list_heading_all', { count: entries.length })
              : loading
                ? spineLabelText(selectedMonth)
                : t('list_heading_month', {
                    month: spineLabelText(selectedMonth),
                    count: entries.length,
                  })}
          </h2>
          {/* 見出しの行に「新規作成」と ✕。月チップの列に置いていたころは、月が 3 つを
              超えて折り返すとボタンが 2 行目の右端に落ちて「位置がずれて」見えた。 */}
          {onCreateEntry && (
            <button
              type="button"
              onClick={onCreateEntry}
              data-verify-part="create-entry"
              className="flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[12px] font-medium transition-opacity hover:opacity-90"
              style={{
                background: 'var(--accent)',
                color: '#fff',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              <span aria-hidden="true">＋</span>
              {t('list_new_entry')}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={t('list_close')}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] transition-colors hover:bg-[rgba(140,133,126,0.12)]"
            style={{ color: '#8C857E' }}
          >
            ✕
          </button>
        </div>

        {/* 月チップ。背表紙を狙わなくても月を切り替えられる。 */}
        <div className="mb-5 flex flex-wrap items-center gap-2" data-chip-group="month">
          <MonthChip
            label={t('chip_all')}
            selected={selectedMonth === null}
            onClick={() => onSelectMonth(null)}
          />
          {months.map((month) => (
            <MonthChip
              key={month}
              label={spineLabelText(month)}
              selected={selectedMonth === month}
              onClick={() => onSelectMonth(month)}
            />
          ))}
        </div>

        {/* 本文の検索。サーバーが絞るので、まだ読み込んでいない古い記録にも当たる。 */}
        {onSearchChange && (
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t('list_search_placeholder')}
            aria-label={t('list_search_placeholder')}
            className="mb-4 w-full rounded-lg px-3 py-2 text-[13px] outline-none"
            style={{
              background: 'rgba(140,133,126,0.06)',
              border: '1px solid rgba(122,116,64,0.14)',
              color: '#4A4541',
            }}
          />
        )}

        {/* 問いで絞る。問いが 1 つも無ければ行ごと出さない（空の帯が残らない）。
            問いは人の言葉なので月チップ（機械ラベル）の形を流用しない: 大文字化も字間も
            掛けず、1 行に収めて長ければ末尾を省く（折り返すと丸い塊になる）。 */}
        {onSelectQuestion && questions.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-2" data-chip-group="question">
            <QuestionChip
              label={t('chip_all_questions')}
              selected={questionId === null}
              control
              onClick={() => onSelectQuestion(null)}
            />
            {questions.map((question) => (
              <QuestionChip
                key={question.id}
                label={question.currentText ?? t('question_untitled')}
                selected={questionId === question.id}
                onClick={() => onSelectQuestion(question.id)}
              />
            ))}
          </div>
        )}

        {rows}
        {loadMore}
      </div>
    </div>
  );
}

/** 紙の上の 1 行（PC）。日付・抜粋・字数・問い・PICKLED。 */
function PaperRow({ entry, onClick }: { entry: StudyEntry; onClick: () => void }) {
  const t = useTranslations('study');
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col gap-1 border-t px-1 py-3 text-left transition-colors hover:bg-[rgba(140,133,126,0.06)]"
      style={{ borderColor: 'rgba(122,116,64,0.12)' }}
    >
      <div className="flex items-baseline gap-3">
        <span
          className="text-[10px] tracking-[0.12em]"
          style={{ color: '#A8A381', fontFamily: 'Inter, sans-serif' }}
        >
          {formatRowDate(entry.createdAt)}
        </span>
        <span className="flex-1 truncate text-[13px]" style={{ color: '#4A4541' }}>
          {entry.excerpt}
        </span>
        <span
          className="text-[9px] uppercase tracking-[0.14em]"
          style={{ color: '#A8A381', fontFamily: 'Inter, sans-serif' }}
        >
          {t('row_chars', { count: entry.chars })}
        </span>
      </div>

      {(entry.linkedQuestions.length > 0 || entry.pickled) && (
        <div className="flex flex-wrap items-center gap-2 pl-[42px]">
          {entry.linkedQuestions.map((question) => (
            <span key={question.id} className="text-[10px]" style={{ color: '#8C857E' }}>
              ◦ {question.currentText ?? ''}
            </span>
          ))}
          {entry.pickled && <PickledBadge />}
        </div>
      )}
    </button>
  );
}

/**
 * 全画面の 1 行（SP）。**抜粋を主役に**、日付・問い・PICKLED は 2 行目に小さく。
 * 字数は出さない（狭い幅では 1 行を抜粋に使う）。
 */
function MobileRow({ entry, onClick }: { entry: StudyEntry; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[56px] w-full flex-col justify-center gap-1 border-b py-3 text-left"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <span className="block truncate text-[15px] leading-snug" style={{ color: 'var(--fg)' }}>
        {entry.excerpt}
      </span>
      <span
        className="flex min-w-0 items-center gap-2 text-[11px]"
        style={{ ...CONTROL_FONT, color: 'var(--date-color)' }}
      >
        <span className="shrink-0 tracking-[0.1em]">{formatRowDate(entry.createdAt)}</span>
        {entry.linkedQuestions[0] ? (
          <span className="min-w-0 truncate" style={{ color: 'var(--accent)' }}>
            ◦ {entry.linkedQuestions[0].currentText ?? ''}
          </span>
        ) : null}
        {entry.pickled && <PickledBadge />}
      </span>
    </button>
  );
}

function PickledBadge() {
  const t = useTranslations('study');
  return (
    <span
      className="shrink-0 rounded-full px-2 py-[1px] text-[8px] uppercase tracking-[0.16em]"
      style={{
        color: '#8EA89C',
        border: '1px solid rgba(142,168,156,0.35)',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {t('row_pickled')}
    </span>
  );
}

/** 塗り分けはどのチップも同じ（選ばれている＝塗る）。 */
function chipStyle(selected: boolean): React.CSSProperties {
  return {
    color: selected ? '#fdfbf7' : '#8C857E',
    background: selected ? '#8EA89C' : 'transparent',
    border: `1px solid ${selected ? '#8EA89C' : 'rgba(122,116,64,0.22)'}`,
  };
}

/** 月の機械ラベル（`ALL` / `2026.09`）。 */
function MonthChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="shrink-0 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.14em] transition-colors"
      style={{ fontFamily: 'Inter, sans-serif', ...chipStyle(selected) }}
    >
      {label}
    </button>
  );
}

/**
 * 問いのチップ。人の言葉なので本文の書体のまま、1 行に収める。
 * `control` は「すべての問い」のようなアプリの言葉（道具の書体で出す）。
 */
function QuestionChip({
  label,
  selected,
  control = false,
  onClick,
}: {
  label: string;
  selected: boolean;
  control?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      title={label}
      className="max-w-full truncate rounded-full px-3 py-1 text-[12px] transition-colors"
      style={{
        ...(control ? { fontFamily: 'Inter, "Noto Sans JP", sans-serif' } : {}),
        ...chipStyle(selected),
      }}
    >
      {label}
    </button>
  );
}

/** 正円のボタン（SP の上段と同じ）。 */
const ROUND_BUTTON_CLASS =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors active:scale-95';
const ROUND_BUTTON_STYLE = {
  background: 'var(--surface-sunken)',
  color: 'var(--fg)',
} as const;

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={ICON_STROKE_WIDTH + 0.2}
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={ICON_STROKE_WIDTH + 0.4}
      strokeLinecap="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
