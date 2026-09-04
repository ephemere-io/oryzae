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
  /** 絞り込み中の月。`null` は全月。 */
  selectedMonth: string | null;
  onSelectMonth: (month: string | null) => void;
  onSelectEntry: (entry: StudyEntry) => void;
  onClose: () => void;
}

/** その月の記録だけに絞る。`null` は全部。 */
export function filterByMonth(entries: readonly StudyEntry[], month: string | null): StudyEntry[] {
  if (month === null) return [...entries];
  return entries.filter((entry) => entry.createdAt.slice(0, 7) === month);
}

/** `2026-09-02T…` → `09.02`。行の先頭に置く日付。 */
export function formatRowDate(createdAt: string): string {
  const date = createdAt.slice(0, 10);
  const [, month, day] = date.split('-');
  return month && day ? `${month}.${day}` : date;
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
  onSelectMonth,
  onSelectEntry,
  onClose,
}: EntryListOverlayProps) {
  const t = useTranslations('study');
  useEscapeKey(open, onClose);

  const visible = filterByMonth(entries, selectedMonth);

  if (!open) return null;

  return (
    <div
      {...verifyAttrs({
        unit: 'EntryListOverlay',
        selectedMonth: selectedMonth ?? 'all',
        rowCount: visible.length,
        monthCount: months.length,
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
              ? t('list_heading_all', { count: visible.length })
              : t('list_heading_month', {
                  month: spineLabelText(selectedMonth),
                  count: visible.length,
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

        {visible.length === 0 ? (
          // 空の行を並べるのではなく、無いと言う。
          <p className="py-10 text-center text-[12px]" style={{ color: '#8C857E' }}>
            {t('list_empty_month')}
          </p>
        ) : (
          <ul className="flex flex-col">
            {visible.map((entry) => (
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
