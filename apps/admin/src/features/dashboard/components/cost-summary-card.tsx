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

  const { actual, estimated } = summary;

  // 実請求額が取れないときに 0 を出さない。未設定/失敗はその旨を表示し、
  // 補助的に推定値を「推定」と明示して見せる。
  if (actual.status !== 'ok' || actual.currentMonthCost === null) {
    return (
      <Shell>
        <div>
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Monthly Cost
          </span>
          <div className="text-xl font-semibold tracking-tight mt-0.5 text-muted-foreground">
            {actual.status === 'not-configured' ? '実請求額 未設定' : '実請求額 取得失敗'}
          </div>
        </div>
        <div className="mt-2 space-y-0.5">
          <p className="text-xs text-muted-foreground">
            推定 {formatCost(estimated.currentMonthCost)}（自前トークン算出）
          </p>
          <p className="text-[10px] text-muted-foreground">
            {actual.status === 'not-configured'
              ? 'ANTHROPIC_ADMIN_KEY 未設定'
              : (actual.message ?? '')}
          </p>
        </div>
      </Shell>
    );
  }

  const lastMonth = actual.lastMonthCost;
  const delta = lastMonth === null ? null : actual.currentMonthCost - lastMonth;
  const isDown = delta !== null && delta <= 0;

  return (
    <Shell>
      <div>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Monthly Cost</span>
        <div className="text-3xl font-semibold tracking-tight mt-0.5">
          {formatCost(actual.currentMonthCost)}
        </div>
      </div>
      <div className="mt-2 space-y-0.5">
        {delta !== null && (
          <span className={`text-xs ${isDown ? 'text-green-500' : 'text-red-500'}`}>
            {isDown ? '↓' : '↑'} {formatCost(Math.abs(delta))} vs last month
          </span>
        )}
        <p className="text-[10px] text-muted-foreground">
          Projected: {formatCost(summary.projectedCost)}
          {summary.projectionBasis === 'estimated' && '（推定ベース）'}
        </p>
      </div>
    </Shell>
  );
}
