'use client';

import type { DashboardStats } from '../hooks/use-dashboard-stats';

interface StatsCardsProps {
  stats: DashboardStats;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-6">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value.toLocaleString()}</p>
    </div>
  );
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Total Users" value={stats.totalUsers} />
      <StatCard label="Total Entries" value={stats.totalEntries} />
      <StatCard label="Total Fermentations" value={stats.totalFermentations} />
      <StatCard label="With Cost Tracking" value={stats.fermentationsWithCostTracking} />
    </div>
  );
}
