'use client';

import { RefreshCw, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DateRangeSelector } from '@/components/ui/date-range-selector';
import { FermentationTable } from '@/features/fermentations/components/fermentation-table';
import { TriggerScheduledFermentationPanel } from '@/features/fermentations/components/trigger-scheduled-fermentation-panel';
import { useFermentations } from '@/features/fermentations/hooks/use-fermentations';
import { useDateRange } from '@/lib/use-date-range';

const STATUS_OPTIONS = ['all', 'completed', 'failed', 'processing', 'pending'] as const;

export default function FermentationsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [userFilter, setUserFilter] = useState('');
  const [appliedUser, setAppliedUser] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { preset, dateFrom, dateTo, selectPreset, setCustomRange } = useDateRange('30d');
  const { data, pagination, loading, error, refresh, retryFermentation } = useFermentations({
    page,
    dateFrom,
    dateTo,
    userId: appliedUser || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
  });

  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const completed = data.filter((i) => i.status === 'completed').length;
  const failed = data.filter((i) => i.status === 'failed').length;

  function handleUserSearch() {
    setAppliedUser(userFilter.trim());
    setPage(1);
  }

  function clearUserFilter() {
    setUserFilter('');
    setAppliedUser('');
    setPage(1);
  }

  function handleStatusChange(s: string) {
    setStatusFilter(s);
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-medium">Fermentations</h1>
          <span className="text-sm text-muted-foreground">
            {pagination.total} total
            <span className="mx-1.5 text-border">|</span>
            {completed} completed
            <span className="mx-1.5 text-border">|</span>
            {failed} failed
          </span>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeSelector
            preset={preset}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onPresetChange={selectPreset}
            onCustomChange={setCustomRange}
          />
          <Button variant="ghost" size="icon-xs" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center">
          <Search className="absolute left-2 h-3 w-3 text-muted-foreground" />
          <input
            type="text"
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUserSearch()}
            placeholder="User ID or email..."
            className="h-7 w-56 rounded-md border border-border bg-transparent pl-7 pr-7 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {appliedUser && (
            <button
              type="button"
              onClick={clearUserFilter}
              className="absolute right-1.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleStatusChange(s)}
              className={`rounded-md px-2 py-1 text-xs transition-colors ${
                statusFilter === s
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <TriggerScheduledFermentationPanel onCompleted={refresh} />

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && data.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
      ) : (
        <>
          <FermentationTable
            items={data}
            onRetry={retryFermentation}
            onRowClick={(id) => router.push(`/fermentations/${id}`)}
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground font-mono">
                {page} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
