'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { spineLabelText } from '../scene/books';

export interface StudyTooltipProps {
  /** `YYYY-MM`。null なら出さない。 */
  month: string | null;
  /** その月の件数。 */
  entryCount: number;
  /** その月の記録の最古・最新（`YYYY-MM-DD`）。記録が無い月は null。 */
  range: { first: string; last: string } | null;
  /** 当月か。 */
  current: boolean;
  /** 貼り付ける画面座標。 */
  screen: { x: number; y: number };
}

/** `2026-09-01` → `09.01`。 */
function shortDate(date: string): string {
  const [, month, day] = date.split('-');
  return month && day ? `${month}.${day}` : date;
}

/**
 * 手帳と背表紙のホバーで出す紙のツールチップ（`docs/oryzae-study/00-overview.md`）。
 *
 * 上段にその冊が何月か、下段に件数と日付の範囲。**その冊に何が入っているか**を
 * 開く前に教えるのが役目なので、件数だけでなく範囲まで出す。
 */
export function StudyTooltip({ month, entryCount, range, current, screen }: StudyTooltipProps) {
  const t = useTranslations('study');
  if (month === null) return null;

  return (
    <div
      {...verifyAttrs({
        unit: 'StudyTooltip',
        month,
        entryCount,
        current,
        hasRange: range !== null,
      })}
      className="pointer-events-none absolute whitespace-nowrap rounded-md px-3 py-2"
      style={{
        left: screen.x,
        top: screen.y,
        transform: 'translate(-50%, -100%)',
        background: '#fdfbf7',
        border: '1px solid rgba(122,116,64,0.18)',
        boxShadow: '0 4px 18px rgba(140,133,126,0.16)',
      }}
    >
      <div
        className="text-[10px] tracking-[0.16em]"
        style={{ color: '#5C4F3F', fontFamily: 'Inter, sans-serif' }}
      >
        {spineLabelText(month)}
        {current ? ` — ${t('tooltip_current')}` : ''}
      </div>
      <div className="mt-0.5 text-[10px]" style={{ color: '#8C857E' }}>
        {t('tooltip_entries', { count: entryCount })}
        {/* 記録が無い月は件数だけ（範囲を作れない）。 */}
        {range ? `　${shortDate(range.first)} – ${shortDate(range.last)}` : ''}
      </div>
    </div>
  );
}
