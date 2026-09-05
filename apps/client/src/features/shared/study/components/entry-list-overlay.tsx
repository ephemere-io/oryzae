'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
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
   * その月の記録を取りに行っている最中か。
   *
   * これが無いと、取得中に「この月の記録はありません」が出てから行が現れる。
   * 手帳の厚みが件数を言っているぶん、0 件の断定はとくに嘘っぽく見える。
   */
  loading?: boolean;
  onSelectMonth: (month: string | null) => void;
  onSelectEntry: (entry: StudyEntry) => void;
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
  onSelectMonth,
  onSelectEntry,
  onClose,
}: EntryListOverlayProps) {
  const t = useTranslations('study');
  useEscapeKey(open, onClose);

  if (!open) return null;

  return (
    <div
      {...verifyAttrs({
        unit: 'EntryListOverlay',
        selectedMonth: selectedMonth ?? 'all',
        rowCount: entries.length,
        monthCount: months.length,
        loading,
      })}
      className="absolute inset-0 z-20 flex items-start justify-center overflow-auto px-6 py-14"
    >
      <div
        className="w-full max-w-[720px] rounded-xl p-6"
        style={{
          background: '#fdfbf7',
          border: '1px solid rgba(122,116,64,0.18)',
          boxShadow: '0 12px 48px rgba(140,133,126,0.18)',
        }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2
            className="text-[10px] font-medium uppercase tracking-[0.2em]"
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
          <button
            type="button"
            onClick={onClose}
            aria-label={t('list_close')}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[13px] transition-colors hover:bg-[rgba(140,133,126,0.12)]"
            style={{ color: '#8C857E' }}
          >
            ✕
          </button>
        </div>

        {/* 月チップ。背表紙を狙わなくても月を切り替えられる（SP はこれが唯一の手段）。 */}
        <div className="mb-5 flex flex-wrap gap-2">
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
      </div>
    </div>
  );
}

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
      className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.14em] transition-colors"
      style={{
        fontFamily: 'Inter, sans-serif',
        color: selected ? '#fdfbf7' : '#8C857E',
        background: selected ? '#8EA89C' : 'transparent',
        border: `1px solid ${selected ? '#8EA89C' : 'rgba(122,116,64,0.22)'}`,
      }}
    >
      {label}
    </button>
  );
}
