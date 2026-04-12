'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DateRangeSelector } from '@/components/ui/date-range-selector';
import { ActivityHeatmap } from '@/features/analytics/components/activity-heatmap';
import { AnalyticsOverviewCards } from '@/features/analytics/components/analytics-overview';
import { DailyChart } from '@/features/analytics/components/daily-chart';
import { PageViewsTable } from '@/features/analytics/components/page-views-table';
import { useAnalytics } from '@/features/analytics/hooks/use-analytics';
import { useDateRange } from '@/lib/use-date-range';

export default function AnalyticsPage() {
  const { preset, dateFrom, dateTo, selectPreset, setCustomRange } = useDateRange('7d');
  const { overview, pages, daily, loading, error, refresh } = useAnalytics({
    dateFrom,
    dateTo,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-medium">Analytics</h1>
          {overview && (
            <span className="text-sm text-muted-foreground">
              {overview.totalPageviews.toLocaleString()} pageviews
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <DateRangeSelector
            preset={preset}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onPresetChange={selectPreset}
            onCustomChange={setCustomRange}
          />
          <Button variant="ghost" size="icon-xs" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && !overview ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
      ) : (
        <>
          {overview && <AnalyticsOverviewCards overview={overview} />}

          <ActivityHeatmap data={daily} />

          <DailyChart data={daily} />

          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Top Pages</p>
            <PageViewsTable items={pages} />
          </div>
        </>
      )}
    </div>
  );
}
