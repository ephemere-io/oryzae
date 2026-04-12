'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatsCards } from '@/features/dashboard/components/stats-cards';
import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard-stats';

export default function DashboardPage() {
  const { stats, loading, error, refresh } = useDashboardStats();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Oryzae の全体統計</p>
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

      {stats ? (
        <StatsCards stats={stats} />
      ) : loading ? (
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      ) : null}
    </div>
  );
}
