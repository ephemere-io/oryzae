'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DateRangeSelector } from '@/components/ui/date-range-selector';
import { CostSummaryCard } from '@/features/dashboard/components/cost-summary-card';
import { FailureAlerts } from '@/features/dashboard/components/failure-alerts';
import { HealthSparklines } from '@/features/dashboard/components/health-sparklines';
import { HealthStatusBanner } from '@/features/dashboard/components/health-status-banner';
import { StatsCards } from '@/features/dashboard/components/stats-cards';
import { UserActivityCard } from '@/features/dashboard/components/user-activity-card';
import { useCostSummary } from '@/features/dashboard/hooks/use-cost-summary';
import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard-stats';
import { useFailureAlerts } from '@/features/dashboard/hooks/use-failure-alerts';
import { useHealthTrends } from '@/features/dashboard/hooks/use-health-trends';
import { useUserActivity } from '@/features/dashboard/hooks/use-user-activity';
import { useDateRange } from '@/lib/use-date-range';

export default function DashboardPage() {
  const { preset, dateFrom, dateTo, selectPreset, setCustomRange } = useDateRange('7d');
  const {
    stats,
    loading: statsLoading,
    error: statsError,
    refresh: refreshStats,
  } = useDashboardStats({ dateFrom, dateTo });
  const {
    groups,
    loading: failuresLoading,
    error: failuresError,
    refresh: refreshFailures,
    retryFermentation,
  } = useFailureAlerts();
  const {
    days,
    loading: trendsLoading,
    error: trendsError,
    refresh: refreshTrends,
  } = useHealthTrends(dateFrom, dateTo);
  const {
    summary,
    loading: costLoading,
    error: costError,
    refresh: refreshCost,
  } = useCostSummary();
  const {
    activeWriters,
    totalUsers,
    returningUsers,
    previousActiveUsers,
    loading: activityLoading,
    error: activityError,
    refresh: refreshActivity,
  } = useUserActivity(dateFrom, dateTo);

  // Active Users カードに表示する期間ラベル（セレクタ連動）。custom は実日付。
  const periodLabel = preset === 'custom' ? `${dateFrom}〜${dateTo}` : preset;

  // 24h 要対応（失敗）件数。健全性バナーと FailureAlerts の両方で使う。
  const failureCount = groups.reduce((sum, g) => sum + g.failures.length, 0);

  const loading =
    statsLoading || failuresLoading || trendsLoading || costLoading || activityLoading;

  const errors = [statsError, failuresError, trendsError, costError, activityError].filter(Boolean);

  const refreshAll = () => {
    refreshStats();
    refreshFailures();
    refreshTrends();
    refreshCost();
    refreshActivity();
  };

  return (
    <div className="space-y-4">
      {/* Row 1: Title + date selector + refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
          <DateRangeSelector
            preset={preset}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onPresetChange={selectPreset}
            onCustomChange={setCustomRange}
          />
        </div>
        <Button variant="ghost" size="icon-sm" onClick={refreshAll} disabled={loading}>
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="rounded-md bg-destructive/10 px-4 py-2.5 text-xs text-destructive space-y-0.5">
          {errors.map((err) => (
            <p key={err}>{err}</p>
          ))}
        </div>
      )}

      {/* At-a-glance health across the 3 axes: 健全性 / 要対応 / コスト / 活性 */}
      <HealthStatusBanner
        stats={stats}
        failureCount={failureCount}
        summary={summary}
        activeWriters={activeWriters}
        totalUsers={totalUsers}
      />

      {/* 障害の早期検知 — 要対応の詳細（異常があれば retry できる） */}
      <section className="space-y-2">
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          要対応 / 障害
        </h2>
        <FailureAlerts groups={groups} retryFermentation={retryFermentation} />
      </section>

      {/* トレンド — 期間内の推移 */}
      <section className="space-y-2">
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          トレンド
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <HealthSparklines days={days} />
        </div>
      </section>

      {/* サマリ — 規模・コスト・活性の詳細 */}
      <section className="space-y-2">
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          サマリ
        </h2>
        <div className="grid gap-4 lg:grid-cols-5">
          {stats ? (
            <StatsCards stats={stats} />
          ) : statsLoading ? (
            <p className="text-xs text-muted-foreground">Loading...</p>
          ) : null}
          <CostSummaryCard summary={summary} />
          <UserActivityCard
            activeWriters={activeWriters}
            totalUsers={totalUsers}
            returningUsers={returningUsers}
            previousActiveUsers={previousActiveUsers}
            periodLabel={periodLabel}
          />
        </div>
      </section>
    </div>
  );
}
