'use client';

import type { DashboardStats } from '../hooks/use-dashboard-stats';

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
}

function StatCard({ label, value, subtitle }: StatCardProps) {
  return (
    <div className="rounded-lg border border-border/50 bg-card p-4">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="text-3xl font-semibold tracking-tight mt-0.5">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

export function StatsCards({ stats }: { stats: DashboardStats }) {
  return (
    <>
      <StatCard label="Users" value={stats.totalUsers} />
      <StatCard label="Entries" value={stats.totalEntries} />
      <StatCard
        label="Fermentations"
        value={stats.totalFermentations}
        subtitle={`${stats.completedFermentations} done / ${stats.failedFermentations} failed`}
      />
    </>
  );
}
