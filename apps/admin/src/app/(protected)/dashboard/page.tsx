'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DateRangeSelector } from '@/components/ui/date-range-selector';
import { CostSummaryCard } from '@/features/dashboard/components/cost-summary-card';
import { FailureAlerts } from '@/features/dashboard/components/failure-alerts';
import { HealthSparklines } from '@/features/dashboard/components/health-sparklines';
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
  } = useDashboardStats();
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
    loading: activityLoading,
    error: activityError,
    refresh: refreshActivity,
  } = useUserActivity(dateFrom, dateTo);

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
    <div className="space-y-6">
      {/* Row 1: Date range + Refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Oryzae の全体統計</p>
          </div>
          <DateRangeSelector
            preset={preset}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onPresetChange={selectPreset}
            onCustomChange={setCustomRange}
          />
        </div>
        <Button variant="outline" size="sm" onClick={refreshAll} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          更新
        </Button>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive space-y-1">
          {errors.map((err) => (
            <p key={err}>{err}</p>
          ))}
        </div>
      )}

      {/* Row 2: Failure alerts (full width) */}
      <FailureAlerts groups={groups} retryFermentation={retryFermentation} />

      {/* Row 3: Health sparklines (half) + Cost summary (half) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <HealthSparklines days={days} />
        <CostSummaryCard summary={summary} />
      </div>

      {/* Row 4: User activity (1/3) + Stats cards (2/3) */}
      <div className="grid gap-4 lg:grid-cols-3">
        <UserActivityCard activeWriters={activeWriters} totalUsers={totalUsers} />
        <div className="lg:col-span-2">
          {stats ? (
            <StatsCards stats={stats} />
          ) : statsLoading ? (
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
