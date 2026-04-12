'use client';

import { StatsCards } from '@/features/dashboard/components/stats-cards';
import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard-stats';

export default function DashboardPage() {
  const { stats, loading, error, refresh } = useDashboardStats();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="rounded border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? '更新中...' : '更新'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {stats ? (
        <StatsCards stats={stats} />
      ) : loading ? (
        <p className="text-sm text-[var(--muted)]">読み込み中...</p>
      ) : null}
    </div>
  );
}
