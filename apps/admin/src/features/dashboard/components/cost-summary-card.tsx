'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CostSummary } from '../hooks/use-cost-summary';

function formatCost(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function CostSummaryCard({ summary }: { summary: CostSummary | null }) {
  if (!summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">今月のコスト</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">データがありません</p>
        </CardContent>
      </Card>
    );
  }

  const delta = summary.currentMonthCost - summary.lastMonthCost;
  const isLess = delta <= 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">今月のコスト</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-2xl font-bold">{formatCost(summary.currentMonthCost)}</div>
        <div className="flex items-center gap-1 text-sm">
          {isLess ? (
            <ArrowDown className="h-4 w-4 text-green-500" />
          ) : (
            <ArrowUp className="h-4 w-4 text-red-500" />
          )}
          <span className={isLess ? 'text-green-500' : 'text-red-500'}>
            {formatCost(Math.abs(delta))}
          </span>
          <span className="text-muted-foreground">vs 先月</span>
        </div>
        <p className="text-xs text-muted-foreground">
          月末予測: {formatCost(summary.projectedCost)}
        </p>
      </CardContent>
    </Card>
  );
}
