'use client';

import type { CostSummary } from '../hooks/use-cost-summary';

function formatCost(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function CostSummaryCard({ summary }: { summary: CostSummary | null }) {
  if (!summary) {
    return (
      <div className="flex flex-col justify-between rounded-lg border border-border/50 bg-card p-4">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Monthly Cost</span>
        <div className="text-3xl font-semibold tracking-tight mt-0.5 text-muted-foreground">--</div>
      </div>
    );
  }

  const delta = summary.currentMonthCost - summary.lastMonthCost;
  const isDown = delta <= 0;

  return (
    <div className="flex flex-col justify-between rounded-lg border border-border/50 bg-card p-4">
      <div>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Monthly Cost</span>
        <div className="text-3xl font-semibold tracking-tight mt-0.5">
          {formatCost(summary.currentMonthCost)}
        </div>
      </div>
      <div className="mt-2 space-y-0.5">
        <span className={`text-xs ${isDown ? 'text-green-500' : 'text-red-500'}`}>
          {isDown ? '\u2193' : '\u2191'} {formatCost(Math.abs(delta))} vs last month
        </span>
        <p className="text-[10px] text-muted-foreground">
          Projected: {formatCost(summary.projectedCost)}
        </p>
      </div>
    </div>
  );
}
