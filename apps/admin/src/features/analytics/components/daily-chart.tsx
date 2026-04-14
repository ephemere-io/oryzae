'use client';

import type { DailyMetric } from '../hooks/use-analytics';

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function DailyChart({ data }: { data: DailyMetric[] }) {
  const maxPageviews = Math.max(...data.map((d) => d.pageviews), 1);
  const barHeight = 140;

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Daily Pageviews
      </h3>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No data</p>
      ) : (
        <div className="flex items-end gap-[2px] overflow-x-auto pb-1">
          {data.map((d) => {
            const pctPageviews = (d.pageviews / maxPageviews) * 100;
            const pctUsers = (d.uniqueUsers / maxPageviews) * 100;
            return (
              <div
                key={d.date}
                className="flex flex-col items-center flex-1 min-w-[24px] max-w-[48px] group"
              >
                {/* Pageview count above bar */}
                <span className="text-[10px] font-mono text-muted-foreground mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {d.pageviews}
                </span>
                {/* Bar container */}
                <div
                  className="relative w-full rounded-t-sm bg-muted/30 overflow-hidden"
                  style={{ height: `${barHeight}px` }}
                >
                  {/* Pageviews bar */}
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-primary/70 rounded-t-sm transition-all"
                    style={{ height: `${pctPageviews}%` }}
                  />
                  {/* Unique users overlay bar */}
                  <div
                    className="absolute bottom-0 left-1/4 right-1/4 bg-primary rounded-t-sm transition-all"
                    style={{ height: `${pctUsers}%` }}
                  />
                </div>
                {/* Date label below */}
                <span className="text-[10px] font-mono text-muted-foreground mt-1 whitespace-nowrap">
                  {formatDateLabel(d.date)}
                </span>
                {/* Unique users count */}
                <span className="text-[9px] text-muted-foreground/70">{d.uniqueUsers}u</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
