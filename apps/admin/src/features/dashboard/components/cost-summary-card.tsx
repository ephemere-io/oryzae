'use client';

import type { CostSummary } from '../hooks/use-cost-summary';

function formatCost(value: number): string {
  return `$${value.toFixed(2)}`;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col justify-between rounded-lg border border-border/50 bg-card p-4">
      {children}
    </div>
  );
}

export function CostSummaryCard({ summary }: { summary: CostSummary | null }) {
  if (!summary) {
    return (
      <Shell>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Monthly Cost</span>
        <div className="text-3xl font-semibold tracking-tight mt-0.5 text-muted-foreground">--</div>
      </Shell>
    );
  }

  const delta = summary.currentMonthCost - summary.lastMonthCost;
  const isDown = delta <= 0;

  return (
    <Shell>
      <div>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Monthly Cost (推定)
        </span>
        <div className="text-3xl font-semibold tracking-tight mt-0.5">
          {formatCost(summary.currentMonthCost)}
        </div>
      </div>
      <div className="mt-2 space-y-0.5">
        <span className={`text-xs ${isDown ? 'text-green-500' : 'text-red-500'}`}>
          {isDown ? '↓' : '↑'} {formatCost(Math.abs(delta))} vs last month
        </span>
        <p className="text-[10px] text-muted-foreground">
          Projected: {formatCost(summary.projectedCost)}
        </p>
        {/* トークン未保存ぶんは推定に含められない。過少計上を隠さない。 */}
        {summary.untrackedCount > 0 && (
          <p className="text-[10px] text-yellow-600 dark:text-yellow-500">
            {summary.untrackedCount} 件はトークン未保存のため未計上
          </p>
        )}
      </div>
    </Shell>
  );
}
