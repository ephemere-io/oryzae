'use client';

import { useMemo } from 'react';
import type { DailyMetric } from '../hooks/use-analytics';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getColorClass(count: number, maxCount: number): string {
  if (count === 0) return 'bg-muted';
  const ratio = count / maxCount;
  if (ratio <= 0.25) return 'bg-green-700 dark:bg-green-800';
  if (ratio <= 0.5) return 'bg-green-500 dark:bg-green-600';
  if (ratio <= 0.75) return 'bg-green-400 dark:bg-green-500';
  return 'bg-green-300 dark:bg-green-400';
}

function formatDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

interface DayCell {
  date: string;
  count: number;
  /** 0=Mon ... 6=Sun (ISO weekday) */
  dayOfWeek: number;
  weekIndex: number;
}

export function ActivityHeatmap({ data }: { data: DailyMetric[] }) {
  const { cells, monthLabels, totalWeeks, maxCount } = useMemo(() => {
    if (data.length === 0) {
      return { cells: [], monthLabels: [], totalWeeks: 0, maxCount: 0 };
    }

    const countMap = new Map<string, number>();
    for (const d of data) {
      countMap.set(d.date, d.pageviews);
    }

    // Determine the date range from data
    const dates = data.map((d) => new Date(d.date));
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    // Align start to Monday
    const start = new Date(minDate);
    const startDow = start.getDay();
    // JS getDay: 0=Sun, so Mon=1 => offset = (startDow + 6) % 7
    const mondayOffset = (startDow + 6) % 7;
    start.setDate(start.getDate() - mondayOffset);

    const dayCells: DayCell[] = [];
    const months: { label: string; weekIndex: number }[] = [];
    let lastMonth = -1;
    let weekIdx = 0;

    const current = new Date(start);
    while (current <= maxDate) {
      // ISO day of week: Mon=0 ... Sun=6
      const jsDay = current.getDay();
      const isoDow = (jsDay + 6) % 7;

      if (isoDow === 0 && dayCells.length > 0) {
        weekIdx++;
      }

      const month = current.getMonth();
      if (month !== lastMonth) {
        months.push({ label: MONTH_LABELS[month], weekIndex: weekIdx });
        lastMonth = month;
      }

      const dateStr = formatDateStr(current);
      dayCells.push({
        date: dateStr,
        count: countMap.get(dateStr) ?? 0,
        dayOfWeek: isoDow,
        weekIndex: weekIdx,
      });

      current.setDate(current.getDate() + 1);
    }

    const mc = Math.max(...dayCells.map((c) => c.count), 1);
    return { cells: dayCells, monthLabels: months, totalWeeks: weekIdx + 1, maxCount: mc };
  }, [data]);

  if (data.length === 0) {
    return (
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
          Activity Heatmap
        </p>
        <p className="text-sm text-muted-foreground text-center py-4">No data</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
        Activity Heatmap
      </p>
      <div className="overflow-x-auto">
        <div className="min-w-fit">
          {/* Day-of-week labels + grid */}
          <div className="flex gap-1">
            {/* Day labels column */}
            <div className="flex flex-col gap-[3px] pr-1">
              {/* Spacer for month labels row */}
              <div className="h-3" />
              {DAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="text-[10px] text-muted-foreground leading-none h-3 flex items-center"
                >
                  {label}
                </div>
              ))}
            </div>
            <div>
              {/* Month labels */}
              <div
                className="grid gap-[3px] mb-[3px]"
                style={{ gridTemplateColumns: `repeat(${totalWeeks}, 12px)` }}
              >
                {Array.from({ length: totalWeeks }, (_, weekIdx) => {
                  const monthLabel = monthLabels.find((m) => m.weekIndex === weekIdx);
                  return (
                    <div
                      key={
                        monthLabel?.label
                          ? `${monthLabel.label}-${weekIdx}`
                          : `empty-week-${weekIdx}`
                      }
                      className="text-[10px] text-muted-foreground leading-none h-3"
                    >
                      {monthLabel?.label ?? ''}
                    </div>
                  );
                })}
              </div>
              {/* Heatmap grid: 7 rows (Mon-Sun) x N columns (weeks) */}
              <div
                className="grid gap-[3px]"
                style={{
                  gridTemplateColumns: `repeat(${totalWeeks}, 12px)`,
                  gridTemplateRows: 'repeat(7, 12px)',
                }}
              >
                {Array.from({ length: totalWeeks * 7 }, (_, i) => {
                  const weekIndex = i % totalWeeks;
                  const dayOfWeek = Math.floor(i / totalWeeks);
                  const cellKey = `w${weekIndex}-d${dayOfWeek}`;
                  const cell = cells.find(
                    (c) => c.weekIndex === weekIndex && c.dayOfWeek === dayOfWeek,
                  );
                  if (!cell) {
                    return <div key={cellKey} />;
                  }
                  return (
                    <div
                      key={cellKey}
                      className={`rounded-sm ${getColorClass(cell.count, maxCount)}`}
                      title={`${cell.date}: ${cell.count} pageviews`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-1 mt-3 text-[10px] text-muted-foreground">
            <span>Less</span>
            <div className="rounded-sm w-3 h-3 bg-muted" />
            <div className="rounded-sm w-3 h-3 bg-green-800" />
            <div className="rounded-sm w-3 h-3 bg-green-600" />
            <div className="rounded-sm w-3 h-3 bg-green-400" />
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  );
}
