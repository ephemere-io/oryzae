'use client';

import { useCallback, useState } from 'react';

export type DatePreset = 'today' | '7d' | '30d' | 'custom';

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function computeRange(preset: DatePreset): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const dateTo = formatDate(now);

  switch (preset) {
    case 'today':
      return { dateFrom: dateTo, dateTo };
    case '7d': {
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      return { dateFrom: formatDate(from), dateTo };
    }
    case '30d': {
      const from = new Date(now);
      from.setDate(from.getDate() - 29);
      return { dateFrom: formatDate(from), dateTo };
    }
    case 'custom':
      return { dateFrom: dateTo, dateTo };
  }
}

export function useDateRange(defaultPreset: DatePreset = '7d') {
  const initial = computeRange(defaultPreset);
  const [preset, setPreset] = useState<DatePreset>(defaultPreset);
  const [dateFrom, setDateFrom] = useState(initial.dateFrom);
  const [dateTo, setDateTo] = useState(initial.dateTo);

  const selectPreset = useCallback((p: DatePreset) => {
    setPreset(p);
    if (p !== 'custom') {
      const range = computeRange(p);
      setDateFrom(range.dateFrom);
      setDateTo(range.dateTo);
    }
  }, []);

  const setCustomRange = useCallback((from: string, to: string) => {
    setPreset('custom');
    setDateFrom(from);
    setDateTo(to);
  }, []);

  return { preset, dateFrom, dateTo, selectPreset, setCustomRange };
}
