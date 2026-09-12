'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import { useEscapeKey } from '@/lib/use-escape-key';
import { spineLabelText } from '../scene/books';
import type { StudyEntry } from '../types';

export interface EntryListOverlayProps {
  open: boolean;
  entries: StudyEntry[];
  /** 選べる月（新しい順）。`ALL` チップは常に先頭に出る。 */
  months: string[];
  /**
   * 絞り込み中の月。`null` は全月。**見出しとチップの表示にだけ使う。**
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

/**
 * 手帳を開いた上にかぶさる一覧（`docs/oryzae-study/00-overview.md`「エントリー一覧の扱い」）。
 *
 * 独立した画面ではなく**書斎の中のオーバーレイ**。`/entries` へ飛ばさないのは、
 * そうすると既存の一覧画面を作り替えることになるため（60-implementation-notes.md §4）。
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

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: 外側を押して閉じるのは補助で、閉じる操作そのものは ✕ ボタンと Esc が担う
    // biome-ignore lint/a11y/useKeyWithClickEvents: キーボードでは Esc で閉じる（useEscapeKey）
    <div
      {...verifyAttrs({
        unit: 'EntryListOverlay',
        selectedMonth: selectedMonth ?? 'all',
        rowCount: entries.length,
        monthCount: months.length,
        loading,
        hasMore,
        questionId: questionId ?? 'all',
        searching: search.length > 0,
        canCreate: onCreateEntry !== undefined,
      })}
      // 幅で形を変える（端末では判定しない）。狭ければ紙は全幅・全高のシートになり、
      // 月チップは横に流れ、行の字は指で読める大きさになる（`@max-lg` = 512px 以下）。
      className="@container absolute inset-0 z-20 flex items-start justify-center overflow-auto px-6 py-14 @max-lg:p-0"
      onPointerDown={(event) => {
        pressedOutside.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (pressedOutside.current && event.target === event.currentTarget) onClose();
        pressedOutside.current = false;
      }}
    >
      <div
        className="w-full max-w-[720px] rounded-xl p-6 @max-lg:min-h-full @max-lg:max-w-none @max-lg:rounded-none @max-lg:px-5 @max-lg:pt-4 @max-lg:pb-10"
        style={{
          background: '#fdfbf7',
          border: '1px solid rgba(122,116,64,0.18)',
          boxShadow: '0 12px 48px rgba(140,133,126,0.18)',
        }}
      >
        {/* 見出しの行に「新規作成」と ✕。月チップの列に置いていたころは、月が 3 つを
            超えて折り返すとボタンが 2 行目の右端に落ちて「位置がずれて」見えた。 */}
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

        {/* 月チップ。背表紙を狙わなくても月を切り替えられる（SP はこれが唯一の手段）。
            狭い幅では折り返さず横に流す（折り返すと 2〜3 段の塊になる）。 */}
        <div
          className="mb-5 flex flex-wrap items-center gap-2 @max-lg:-mx-5 @max-lg:flex-nowrap @max-lg:overflow-x-auto @max-lg:px-5 @max-lg:pb-1"
          style={{ scrollbarWidth: 'none' }}
          data-chip-group="month"
        >
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
            // 狭い幅では 16px にする（iOS はそれ未満の入力欄に触れると画面ごと拡大する）。
            className="mb-4 w-full rounded-lg px-3 py-2 text-[13px] outline-none @max-lg:py-2.5 @max-lg:text-[16px]"
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

        {loading ? (
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
                <button
                  type="button"
                  onClick={() => onSelectEntry(entry)}
                  className="flex w-full flex-col gap-1 border-t px-1 py-3 text-left transition-colors hover:bg-[rgba(140,133,126,0.06)] @max-lg:py-3.5"
                  style={{ borderColor: 'rgba(122,116,64,0.12)' }}
                >
                  <div className="flex items-baseline gap-3">
                    <span
                      className="text-[10px] tracking-[0.12em] @max-lg:text-[11px]"
                      style={{ color: '#A8A381', fontFamily: 'Inter, sans-serif' }}
                    >
                      {formatRowDate(entry.createdAt)}
                    </span>
                    <span
                      className="flex-1 truncate text-[13px] @max-lg:text-[14px]"
                      style={{ color: '#4A4541' }}
                    >
                      {entry.excerpt}
                    </span>
                    {/* 字数は狭い幅では出さない（1 行の幅を抜粋に使う）。 */}
                    <span
                      className="text-[9px] uppercase tracking-[0.14em] @max-lg:hidden"
                      style={{ color: '#A8A381', fontFamily: 'Inter, sans-serif' }}
                    >
                      {t('row_chars', { count: entry.chars })}
                    </span>
                  </div>

                  {(entry.linkedQuestions.length > 0 || entry.pickled) && (
                    <div className="flex flex-wrap items-center gap-2 pl-[42px] @max-lg:pl-[46px]">
                      {entry.linkedQuestions.map((question) => (
                        <span
                          key={question.id}
                          className="text-[10px]"
                          style={{ color: '#8C857E' }}
                        >
                          ◦ {question.currentText ?? ''}
                        </span>
                      ))}
                      {entry.pickled && (
                        <span
                          className="rounded-full px-2 py-[1px] text-[8px] uppercase tracking-[0.16em]"
                          style={{
                            color: '#8EA89C',
                            border: '1px solid rgba(142,168,156,0.35)',
                            fontFamily: 'Inter, sans-serif',
                          }}
                        >
                          {t('row_pickled')}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* ALL は直近から順に取る。ここを押さないと古い記録に辿り着けない。 */}
        {hasMore && onLoadMore && !loading && (
          <button
            type="button"
            onClick={onLoadMore}
            className="mt-4 w-full rounded-lg py-3 text-center text-[12px] transition-colors hover:bg-[rgba(140,133,126,0.08)]"
            style={{ color: '#8C857E', border: '1px solid rgba(122,116,64,0.14)' }}
          >
            {t('list_load_more')}
          </button>
        )}
      </div>
    </div>
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

/** 月の機械ラベル（`ALL` / `2026.09`）。狭い幅では横に流れるので縮めない。 */
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
      className="shrink-0 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.14em] transition-colors @max-lg:px-3.5 @max-lg:py-1.5 @max-lg:text-[11px]"
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
      className="max-w-full truncate rounded-full px-3 py-1 text-[12px] transition-colors @max-lg:py-1.5 @max-lg:text-[13px]"
      style={{
        ...(control ? { fontFamily: 'Inter, "Noto Sans JP", sans-serif' } : {}),
        ...chipStyle(selected),
      }}
    >
      {label}
    </button>
  );
}
