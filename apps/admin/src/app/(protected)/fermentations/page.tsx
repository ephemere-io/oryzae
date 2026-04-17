'use client';

import { RefreshCw, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DateRangeSelector } from '@/components/ui/date-range-selector';
import { FermentationTable } from '@/features/fermentations/components/fermentation-table';
import { TriggerScheduledFermentationPanel } from '@/features/fermentations/components/trigger-scheduled-fermentation-panel';
import { useFermentations } from '@/features/fermentations/hooks/use-fermentations';
import { useUsers } from '@/features/users/hooks/use-users';
import { useDateRange } from '@/lib/use-date-range';

const STATUS_OPTIONS = ['all', 'completed', 'failed', 'processing', 'pending'] as const;

function UserSearchCombobox({
  users,
  onSelect,
  onClear,
  selectedLabel,
}: {
  users: { id: string; email: string }[];
  onSelect: (userId: string, label: string) => void;
  onClear: () => void;
  selectedLabel: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!query) return [];
    const q = query.toLowerCase();
    return users.filter((u) => u.email.toLowerCase().includes(q) || u.id.includes(q)).slice(0, 8);
  }, [users, query]);

  function handleSelect(user: { id: string; email: string }) {
    onSelect(user.id, user.email);
    setQuery('');
    setOpen(false);
  }

  if (selectedLabel) {
    return (
      <div className="flex h-7 items-center gap-1.5 rounded-md border border-border bg-transparent px-2 text-xs">
        <Search className="h-3 w-3 text-muted-foreground" />
        <span className="max-w-48 truncate">{selectedLabel}</span>
        <button
          type="button"
          onClick={onClear}
          className="ml-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => query && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="ユーザーを検索..."
        className="h-7 w-56 rounded-md border border-border bg-transparent pl-7 pr-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
      {open && filtered.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-md border border-border bg-background shadow-lg">
          {filtered.map((user) => (
            <button
              key={user.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(user)}
              className="flex w-full flex-col px-3 py-1.5 text-left text-xs hover:bg-muted"
            >
              <span className="truncate">{user.email}</span>
              <span className="truncate font-mono text-[10px] text-muted-foreground">
                {user.id.slice(0, 12)}...
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FermentationsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [appliedUser, setAppliedUser] = useState('');
  const [appliedUserLabel, setAppliedUserLabel] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { preset, dateFrom, dateTo, selectPreset, setCustomRange } = useDateRange('30d');
  const { users } = useUsers();
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

  function handleUserSelect(userId: string, label: string) {
    setAppliedUser(userId);
    setAppliedUserLabel(label);
    setPage(1);
  }

  function clearUserFilter() {
    setAppliedUser('');
    setAppliedUserLabel('');
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
        <UserSearchCombobox
          users={users}
          onSelect={handleUserSelect}
          onClear={clearUserFilter}
          selectedLabel={appliedUserLabel}
        />
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
