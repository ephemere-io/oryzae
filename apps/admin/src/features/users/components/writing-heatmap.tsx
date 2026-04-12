'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { EntryDate } from '../hooks/use-user-detail';

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

function getColorClass(count: number): string {
  if (count === 0) return 'bg-muted';
  if (count === 1) return 'bg-green-300 dark:bg-green-700';
  if (count <= 3) return 'bg-green-500 dark:bg-green-500';
  return 'bg-green-700 dark:bg-green-300';
}

function formatDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

interface DayCell {
  date: string;
  count: number;
  dayOfWeek: number;
  weekIndex: number;
}

export function WritingHeatmap({ entryDates }: { entryDates: EntryDate[] }) {
  const { cells, monthLabels, totalWeeks } = useMemo(() => {
    const countMap = new Map<string, number>();
    for (const ed of entryDates) {
      countMap.set(ed.date, ed.count);
    }

    const today = new Date();
    // Start from 364 days ago (to get 365 days total including today)
    const start = new Date(today);
    start.setDate(start.getDate() - 364);
    // Align to the start of the week (Sunday)
    start.setDate(start.getDate() - start.getDay());

    const dayCells: DayCell[] = [];
    const months: { label: string; weekIndex: number }[] = [];
    let lastMonth = -1;
    let weekIdx = 0;

    const current = new Date(start);
    while (current <= today) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek === 0 && dayCells.length > 0) {
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
        dayOfWeek,
        weekIndex: weekIdx,
      });

      current.setDate(current.getDate() + 1);
    }

    return { cells: dayCells, monthLabels: months, totalWeeks: weekIdx + 1 };
  }, [entryDates]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Writing Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-fit">
            {/* Month labels */}
            <div
              className="grid gap-[3px] mb-1 ml-0"
              style={{ gridTemplateColumns: `repeat(${totalWeeks}, 12px)` }}
            >
              {Array.from({ length: totalWeeks }, (_, weekIdx) => {
                const monthLabel = monthLabels.find((m) => m.weekIndex === weekIdx);
                return (
                  <div
                    key={
                      monthLabel?.label ? `${monthLabel.label}-${weekIdx}` : `empty-week-${weekIdx}`
                    }
                    className="text-[10px] text-muted-foreground leading-none h-3"
                  >
                    {monthLabel?.label ?? ''}
                  </div>
                );
              })}
            </div>
            {/* Heatmap grid: 7 rows x N columns */}
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
                    className={`rounded-sm ${getColorClass(cell.count)}`}
                    title={`${cell.date}: ${cell.count} entries`}
                  />
                );
              })}
            </div>
          </div>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
          <span>Less</span>
          <div className="rounded-sm w-3 h-3 bg-muted" />
          <div className="rounded-sm w-3 h-3 bg-green-300 dark:bg-green-700" />
          <div className="rounded-sm w-3 h-3 bg-green-500 dark:bg-green-500" />
          <div className="rounded-sm w-3 h-3 bg-green-700 dark:bg-green-300" />
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  );
}
