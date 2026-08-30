'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import {
  BOARD_INSET,
  CONTROL_FONT,
  CONTROL_TEXT,
  GHOST_BUTTON_CLASS,
  IDLE_HOVER_CLASS,
  PLAIN_ROW_CLASS,
} from './board-surface';

interface BoardDateNavProps {
  dateKey: string;
  viewType: 'daily' | 'weekly';
  onDateChange: (dateKey: string) => void;
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDailyLabel(dateKey: string, days: readonly string[]): string {
  const d = new Date(`${dateKey}T00:00:00`);
  return `${dateKey.replace(/-/g, '.')} — ${days[d.getDay()]}`;
}

// Monday–Sunday range, matching server-side weekRange() in load-board.usecase.ts
function weekRange(dateKey: string): { start: string; end: string } {
  const d = new Date(`${dateKey}T00:00:00`);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: toDateKey(monday), end: toDateKey(sunday) };
}

function formatWeeklyLabel(dateKey: string): string {
  const { start, end } = weekRange(dateKey);
  return `${start.replace(/-/g, '.')} — ${end.replace(/-/g, '.')}`;
}

function shiftDate(dateKey: string, offset: number): string {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + offset);
  return toDateKey(d);
}

/**
 * 盤面左上の日付ナビ（‹ ラベル ›）。
 *
 * viewType は受け取るが切り替えは持たない。ラベル（1日 or 月〜日の範囲）と送り幅
 * （1日 or 7日）が viewType で変わるため表示にだけ使う。切り替え自体は右上の
 * BoardViewSwitch、作成系の道具は下部の BoardToolbar が持つ。
 */
export function BoardDateNav({ dateKey, viewType, onDateChange }: BoardDateNavProps) {
  const t = useTranslations('board');
  const days = [
    t('date.day_sun'),
    t('date.day_mon'),
    t('date.day_tue'),
    t('date.day_wed'),
    t('date.day_thu'),
    t('date.day_fri'),
    t('date.day_sat'),
  ];
  const offset = viewType === 'weekly' ? 7 : 1;
  const label =
    viewType === 'weekly' ? formatWeeklyLabel(dateKey) : formatDailyLabel(dateKey, days);
  return (
    <div
      {...verifyAttrs({ unit: 'BoardDateNav', viewType, dateKey, label })}
      // ここは「今どこを見ているか」の情報。面を持たせず、盤面に直接置かれた文字として
      // 読ませる（浮かせるのは道具箱だけ、という約束を崩さない）。左端はサイドバー幅ぶん
      // 寄せる（--sidebar-width は (protected)/layout.tsx が <main> に生やしている）。
      className={`${PLAIN_ROW_CLASS} h-8`}
      style={{
        ...CONTROL_FONT,
        top: BOARD_INSET,
        left: `calc(var(--sidebar-width, 0px) + ${BOARD_INSET}px)`,
      }}
    >
      <button
        type="button"
        onClick={() => onDateChange(shiftDate(dateKey, -offset))}
        data-verify-nav="prev"
        className={`${GHOST_BUTTON_CLASS} ${IDLE_HOVER_CLASS} hover:text-[var(--fg)]`}
        style={{ color: 'var(--date-color)' }}
      >
        ‹
      </button>
      <span className={`px-1 ${CONTROL_TEXT}`} style={{ color: 'var(--fg)' }}>
        {label}
      </span>
      <button
        type="button"
        onClick={() => onDateChange(shiftDate(dateKey, offset))}
        data-verify-nav="next"
        className={`${GHOST_BUTTON_CLASS} ${IDLE_HOVER_CLASS} hover:text-[var(--fg)]`}
        style={{ color: 'var(--date-color)' }}
      >
        ›
      </button>
    </div>
  );
}
