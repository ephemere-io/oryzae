'use client';

import { Button } from '@/components/ui/button';
import type { DatePreset } from '@/lib/use-date-range';

interface DateRangeSelectorProps {
  preset: DatePreset;
  dateFrom: string;
  dateTo: string;
  onPresetChange: (preset: DatePreset) => void;
  onCustomChange: (dateFrom: string, dateTo: string) => void;
}

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: 'custom', label: 'Custom' },
];

export function DateRangeSelector({
  preset,
  dateFrom,
  dateTo,
  onPresetChange,
  onCustomChange,
}: DateRangeSelectorProps) {
  return (
    <div className="flex items-center gap-1">
      {PRESETS.map((p) => (
        <Button
          key={p.value}
          variant={preset === p.value ? 'default' : 'ghost'}
          size="xs"
          className="text-[12px] h-7"
          onClick={() => onPresetChange(p.value)}
        >
          {p.label}
        </Button>
      ))}
      {preset === 'custom' && (
        <div className="flex items-center gap-1 ml-1">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onCustomChange(e.target.value, dateTo)}
            className="h-7 rounded-md border border-border bg-background px-2 text-[12px] text-foreground"
          />
          <span className="text-muted-foreground text-[12px]">-</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onCustomChange(dateFrom, e.target.value)}
            className="h-7 rounded-md border border-border bg-background px-2 text-[12px] text-foreground"
          />
        </div>
      )}
    </div>
  );
}
