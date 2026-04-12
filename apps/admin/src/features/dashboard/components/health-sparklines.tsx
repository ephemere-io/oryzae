'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TrendDay } from '../hooks/use-health-trends';

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function SuccessRateChart({ days }: { days: TrendDay[] }) {
  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">発酵成功率</CardTitle>
      </CardHeader>
      <CardContent>
        {days.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">データがありません</p>
        ) : (
          <div className="flex items-end gap-1.5 h-24">
            {days.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <div className="relative w-full h-20 flex items-end">
                  <div
                    className={`w-full rounded-sm transition-all ${d.successRate > 80 ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ height: `${d.successRate}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{formatDateLabel(d.date)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActiveWritersChart({ days }: { days: TrendDay[] }) {
  const maxWriters = Math.max(...days.map((d) => d.activeWriters), 1);

  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          アクティブライター
        </CardTitle>
      </CardHeader>
      <CardContent>
        {days.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">データがありません</p>
        ) : (
          <div className="flex items-end gap-1.5 h-24">
            {days.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <div className="relative w-full h-20 flex items-end">
                  <div
                    className="w-full rounded-sm bg-primary transition-all"
                    style={{ height: `${(d.activeWriters / maxWriters) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{formatDateLabel(d.date)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function HealthSparklines({ days }: { days: TrendDay[] }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <SuccessRateChart days={days} />
      <ActiveWritersChart days={days} />
    </div>
  );
}
