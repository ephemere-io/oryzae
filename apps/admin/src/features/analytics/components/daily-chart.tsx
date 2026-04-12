'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DailyMetric } from '../hooks/use-analytics';

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function DailyChart({ data }: { data: DailyMetric[] }) {
  const maxPageviews = Math.max(...data.map((d) => d.pageviews), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Daily Pageviews</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">データがありません</p>
        ) : (
          <div className="space-y-2">
            {data.map((d) => (
              <div key={d.date} className="flex items-center gap-3 text-sm">
                <span className="w-12 text-right text-muted-foreground shrink-0">
                  {formatDateLabel(d.date)}
                </span>
                <div className="flex-1 h-6 bg-muted rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-sm transition-all"
                    style={{ width: `${(d.pageviews / maxPageviews) * 100}%` }}
                  />
                </div>
                <span className="w-16 text-right font-mono shrink-0">
                  {d.pageviews.toLocaleString()}
                </span>
                <span className="w-12 text-right text-muted-foreground shrink-0">
                  {d.uniqueUsers} u
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
