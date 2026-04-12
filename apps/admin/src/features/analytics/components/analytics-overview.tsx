'use client';

import type { AnalyticsOverview } from '../hooks/use-analytics';

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

interface MetricProps {
  label: string;
  value: string | number;
  sub?: string;
}

function Metric({ label, value, sub }: MetricProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-medium tabular-nums">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function AnalyticsOverviewCards({ overview }: { overview: AnalyticsOverview }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
      <Metric label="Pageviews" value={overview.totalPageviews} sub="Selected period" />
      <Metric label="Sessions" value={overview.totalSessions} sub="Unique sessions" />
      <Metric label="Avg Duration" value={formatDuration(overview.avgSessionDurationSeconds)} />
      <Metric label="Entry Views" value={overview.entryPageViews} sub="/entries" />
      <Metric label="Jar Views" value={overview.jarPageViews} sub="/jar" />
    </div>
  );
}
