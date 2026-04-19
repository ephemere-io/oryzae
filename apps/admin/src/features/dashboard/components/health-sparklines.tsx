'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TrendDay } from '../hooks/use-health-trends';

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function SuccessRateChart({ days }: { days: TrendDay[] }) {
  const latest = days.length > 0 ? days[days.length - 1] : null;
  const currentValue = latest ? `${Math.round(latest.successRate)}%` : '--';
  const data = days.map((d) => ({
    name: formatDateLabel(d.date),
    rate: Math.round(d.successRate),
  }));

  return (
    <div className="rounded-lg border border-border/50 bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Success Rate</span>
        <span className="text-2xl font-semibold tracking-tight">{currentValue}</span>
      </div>
      <div className="h-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="successGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10 }}
              stroke="hsl(var(--muted-foreground))"
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: '1px solid hsl(var(--border))',
              }}
              formatter={(value) => [`${value}%`, 'Success Rate']}
            />
            <Area
              type="monotone"
              dataKey="rate"
              stroke="#22c55e"
              fill="url(#successGrad)"
              strokeWidth={2}
            />
            {/* 80% target line */}
            <Line
              type="monotone"
              dataKey={() => 80}
              stroke="#ef4444"
              strokeDasharray="4 4"
              strokeWidth={1}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function FermentationsChart({ days }: { days: TrendDay[] }) {
  const totalForPeriod = days.reduce((sum, d) => sum + d.totalFermentations, 0);
  const data = days.map((d) => ({
    name: formatDateLabel(d.date),
    completed: d.completedFermentations,
    failed: d.totalFermentations - d.completedFermentations,
  }));

  return (
    <div className="rounded-lg border border-border/50 bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Fermentations
        </span>
        <span className="text-2xl font-semibold tracking-tight">{totalForPeriod}</span>
      </div>
      <div className="h-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis
              tick={{ fontSize: 10 }}
              stroke="hsl(var(--muted-foreground))"
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: '1px solid hsl(var(--border))',
              }}
            />
            <Bar
              dataKey="completed"
              stackId="a"
              fill="#22c55e"
              radius={[0, 0, 0, 0]}
              name="Completed"
            />
            <Bar dataKey="failed" stackId="a" fill="#ef4444" radius={[2, 2, 0, 0]} name="Failed" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ActiveWritersChart({ days }: { days: TrendDay[] }) {
  const latest = days.length > 0 ? days[days.length - 1] : null;
  const currentValue = latest ? String(latest.activeWriters) : '--';
  const data = days.map((d) => ({ name: formatDateLabel(d.date), writers: d.activeWriters }));

  return (
    <div className="rounded-lg border border-border/50 bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Active Writers
        </span>
        <span className="text-2xl font-semibold tracking-tight">{currentValue}</span>
      </div>
      <div className="h-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis
              tick={{ fontSize: 10 }}
              stroke="hsl(var(--muted-foreground))"
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: '1px solid hsl(var(--border))',
              }}
            />
            <Line
              type="monotone"
              dataKey="writers"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Writers"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function HealthSparklines({ days }: { days: TrendDay[] }) {
  return (
    <>
      <SuccessRateChart days={days} />
      <FermentationsChart days={days} />
      <ActiveWritersChart days={days} />
    </>
  );
}
