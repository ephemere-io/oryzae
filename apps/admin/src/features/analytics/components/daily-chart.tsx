'use client';

import type { DailyMetric } from '../hooks/use-analytics';

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function DailyChart({ data }: { data: DailyMetric[] }) {
  const maxPageviews = Math.max(...data.map((d) => d.pageviews), 1);

  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Daily Pageviews</p>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No data</p>
      ) : (
        <div className="space-y-1.5">
          {data.map((d) => (
            <div key={d.date} className="flex items-center gap-3 text-sm">
              <span className="w-10 text-right text-xs text-muted-foreground font-mono shrink-0">
                {formatDateLabel(d.date)}
              </span>
              <div className="flex-1 h-4 bg-muted/50 rounded-sm overflow-hidden">
                <div
                  className="h-full bg-primary/80 rounded-sm transition-all"
                  style={{ width: `${(d.pageviews / maxPageviews) * 100}%` }}
                />
              </div>
              <span className="w-12 text-right font-mono text-xs shrink-0">
                {d.pageviews.toLocaleString()}
              </span>
              <span className="w-8 text-right text-[11px] text-muted-foreground shrink-0">
                {d.uniqueUsers}u
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
