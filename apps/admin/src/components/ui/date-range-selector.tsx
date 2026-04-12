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
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
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
    <div className="flex items-center gap-2">
      {PRESETS.map((p) => (
        <Button
          key={p.value}
          variant={preset === p.value ? 'default' : 'outline'}
          size="sm"
          onClick={() => onPresetChange(p.value)}
        >
          {p.label}
        </Button>
      ))}
      {preset === 'custom' && (
        <div className="flex items-center gap-1 ml-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onCustomChange(e.target.value, dateTo)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          />
          <span className="text-muted-foreground text-sm">~</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onCustomChange(dateFrom, e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          />
        </div>
      )}
    </div>
  );
}
