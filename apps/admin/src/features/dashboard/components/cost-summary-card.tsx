'use client';

import Link from 'next/link';
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

  // 実請求額が取れないときに 0 を出さない。推定でも代用しない（発酵だけの推定を
  // 「今月のコスト」として読ませると、OCR・CI などの分が抜けた数字になる）。
  if (summary.status !== 'ok' || summary.currentMonthCost === null) {
    return (
      <Shell>
        <div>
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Monthly Cost
          </span>
          <div className="text-xl font-semibold tracking-tight mt-0.5 text-muted-foreground">
            {summary.status === 'not-configured' ? '実請求額 未設定' : '実請求額 取得失敗'}
          </div>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          {summary.status === 'not-configured'
            ? 'ANTHROPIC_ADMIN_KEY 未設定'
            : (summary.message ?? '')}
        </p>
      </Shell>
    );
  }

  const lastMonth = summary.lastMonthCost;
  const delta = lastMonth === null ? null : summary.currentMonthCost - lastMonth;
  const isDown = delta !== null && delta <= 0;

  return (
    <Shell>
      <div>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Monthly Cost</span>
        <div className="text-3xl font-semibold tracking-tight mt-0.5">
          {formatCost(summary.currentMonthCost)}
        </div>
      </div>
      <div className="mt-2 space-y-0.5">
        {delta !== null && (
          <span className={`text-xs ${isDown ? 'text-green-500' : 'text-red-500'}`}>
            {isDown ? '↓' : '↑'} {formatCost(Math.abs(delta))} vs last month
          </span>
        )}
        {summary.projectedCost !== null && (
          <p className="text-[10px] text-muted-foreground">
            Projected: {formatCost(summary.projectedCost)}
          </p>
        )}
        <Link
          href="/costs"
          className="text-[10px] text-muted-foreground underline hover:text-foreground"
        >
          内訳を見る
        </Link>
      </div>
    </Shell>
  );
}
