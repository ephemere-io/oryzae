'use client';

import type { DashboardStats } from '../hooks/use-dashboard-stats';

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  warning?: boolean;
}

function StatCard({ label, value, subtitle, warning }: StatCardProps) {
  return (
    <div className="rounded-lg border border-border/50 bg-card p-4">
      <div className="flex items-center gap-1.5">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        {warning && <span className="size-1.5 rounded-full bg-red-500" />}
      </div>
      <div className="text-3xl font-semibold tracking-tight mt-0.5">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

export function StatsCards({ stats }: { stats: DashboardStats }) {
  const successRate =
    stats.totalFermentations > 0
      ? Math.round((stats.completedFermentations / stats.totalFermentations) * 100)
      : 0;

  return (
    <div className="grid gap-4 grid-cols-3">
      <StatCard label="Users" value={stats.totalUsers} />
      <StatCard label="Entries" value={stats.totalEntries} />
      <StatCard
        label="Fermentations"
        value={stats.totalFermentations}
        subtitle={`${stats.completedFermentations} done / ${stats.failedFermentations} failed`}
      />
      <StatCard
        label="Success Rate"
        value={`${successRate}%`}
        subtitle={successRate < 80 ? 'Below target (80%)' : undefined}
        warning={successRate < 80}
      />
      <StatCard
        label="Cost Tracked"
        value={stats.fermentationsWithCostTracking}
        subtitle="With Gateway data"
      />
    </div>
  );
}
