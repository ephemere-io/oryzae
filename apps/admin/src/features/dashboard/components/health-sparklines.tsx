'use client';

import type { TrendDay } from '../hooks/use-health-trends';

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[d.getDay()] ?? '';
}

const PLACEHOLDER_DAYS = 7;
const BAR_WIDTH = 3;
const BAR_GAP = 4;
const BAR_MAX_HEIGHT = 48;

function SparkBars({ values, colorFn }: { values: number[]; colorFn: (value: number) => string }) {
  if (values.length === 0) {
    return (
      <div className="flex items-end" style={{ gap: `${BAR_GAP}px` }}>
        {Array.from({ length: PLACEHOLDER_DAYS }).map((_, i) => (
          <div
            key={`placeholder-${
              // biome-ignore lint/suspicious/noArrayIndexKey: placeholder bars have no stable id
              i
            }`}
            className="rounded-full bg-muted"
            style={{
              width: `${BAR_WIDTH}px`,
              height: `${BAR_MAX_HEIGHT * 0.2}px`,
            }}
          />
        ))}
      </div>
    );
  }

  const max = Math.max(...values, 1);

  return (
    <div className="flex items-end" style={{ gap: `${BAR_GAP}px` }}>
      {values.map((v, i) => {
        const height = Math.max((v / max) * BAR_MAX_HEIGHT, 2);
        return (
          <div
            key={`bar-${
              // biome-ignore lint/suspicious/noArrayIndexKey: bar index is stable within render
              i
            }`}
            className={`rounded-full ${colorFn(v)}`}
            style={{
              width: `${BAR_WIDTH}px`,
              height: `${height}px`,
            }}
          />
        );
      })}
    </div>
  );
}

function SuccessRateCard({ days }: { days: TrendDay[] }) {
  const latest = days.length > 0 ? days[days.length - 1] : null;
  const currentValue = latest ? `${Math.round(latest.successRate)}%` : '--';

  return (
    <div className="flex flex-col justify-between rounded-lg border border-border/50 bg-card p-4">
      <div>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Success Rate</span>
        <div className="text-3xl font-semibold tracking-tight mt-0.5">{currentValue}</div>
      </div>
      <div className="mt-3 flex items-end gap-0">
        <div className="flex-1">
          <SparkBars
            values={days.map((d) => d.successRate)}
            colorFn={(v) => (v > 80 ? 'bg-green-500' : 'bg-red-500')}
          />
          {days.length > 0 && (
            <div className="flex mt-1" style={{ gap: `${BAR_GAP}px` }}>
              {days.map((d) => (
                <span
                  key={d.date}
                  className="text-[8px] text-muted-foreground/60 text-center"
                  style={{ width: `${BAR_WIDTH}px` }}
                >
                  {formatDayLabel(d.date).charAt(0)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActiveWritersCard({ days }: { days: TrendDay[] }) {
  const latest = days.length > 0 ? days[days.length - 1] : null;
  const currentValue = latest ? String(latest.activeWriters) : '--';

  return (
    <div className="flex flex-col justify-between rounded-lg border border-border/50 bg-card p-4">
      <div>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Active Writers
        </span>
        <div className="text-3xl font-semibold tracking-tight mt-0.5">{currentValue}</div>
      </div>
      <div className="mt-3 flex items-end gap-0">
        <div className="flex-1">
          <SparkBars values={days.map((d) => d.activeWriters)} colorFn={() => 'bg-primary'} />
          {days.length > 0 && (
            <div className="flex mt-1" style={{ gap: `${BAR_GAP}px` }}>
              {days.map((d) => (
                <span
                  key={d.date}
                  className="text-[8px] text-muted-foreground/60 text-center"
                  style={{ width: `${BAR_WIDTH}px` }}
                >
                  {formatDayLabel(d.date).charAt(0)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function HealthSparklines({ days }: { days: TrendDay[] }) {
  return (
    <>
      <SuccessRateCard days={days} />
      <ActiveWritersCard days={days} />
    </>
  );
}
