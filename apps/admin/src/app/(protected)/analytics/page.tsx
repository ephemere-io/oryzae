'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnalyticsOverviewCards } from '@/features/analytics/components/analytics-overview';
import { DailyChart } from '@/features/analytics/components/daily-chart';
import { PageViewsTable } from '@/features/analytics/components/page-views-table';
import { useAnalytics } from '@/features/analytics/hooks/use-analytics';

export default function AnalyticsPage() {
  const { overview, pages, daily, loading, error, refresh } = useAnalytics();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">PostHog 行動メトリクス（過去7日間）</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          更新
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && !overview ? (
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      ) : (
        <>
          {overview && <AnalyticsOverviewCards overview={overview} />}

          <div className="grid gap-6 lg:grid-cols-2">
            <DailyChart data={daily} />
            <div>
              <h2 className="text-lg font-semibold mb-3">ページ別アクセス</h2>
              <PageViewsTable items={pages} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
