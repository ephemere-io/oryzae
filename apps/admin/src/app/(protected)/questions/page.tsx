'use client';

import { RefreshCw, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { QuestionTable } from '@/features/questions/components/question-table';
import { useQuestions } from '@/features/questions/hooks/use-questions';
import { useUsers } from '@/features/users/hooks/use-users';

const ARCHIVED_OPTIONS = ['active', 'archived', 'all'] as const;
type ArchivedOption = (typeof ARCHIVED_OPTIONS)[number];

function archivedToParam(value: ArchivedOption): 'true' | 'false' | undefined {
  if (value === 'archived') return 'true';
  if (value === 'active') return 'false';
  return undefined;
}

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

export default function QuestionsPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [appliedUser, setAppliedUser] = useState('');
  const [appliedUserLabel, setAppliedUserLabel] = useState('');
  const [archivedFilter, setArchivedFilter] = useState<ArchivedOption>('active');
  const { users } = useUsers();
  const { data, pagination, loading, error, refresh } = useQuestions({
    page,
    q: appliedQuery || undefined,
    userId: appliedUser || undefined,
    archived: archivedToParam(archivedFilter),
  });

  // 検索 input は debounce: 入力停止 300ms で apply。
  useEffect(() => {
    const id = setTimeout(() => {
      if (appliedQuery !== searchInput) {
        setAppliedQuery(searchInput);
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput, appliedQuery]);

  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const eligibleCount = data.filter((d) => d.readiness.eligible).length;

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

  function handleArchivedChange(value: ArchivedOption) {
    setArchivedFilter(value);
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-medium">Questions</h1>
          <span className="text-sm text-muted-foreground">
            {pagination.total} total
            <span className="mx-1.5 text-border">|</span>
            {eligibleCount} eligible (page)
          </span>
        </div>
        <Button variant="ghost" size="icon-xs" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <UserSearchCombobox
          users={users}
          onSelect={handleUserSelect}
          onClear={clearUserFilter}
          selectedLabel={appliedUserLabel}
        />
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="問いを検索..."
            className="h-7 w-64 rounded-md border border-border bg-transparent pl-7 pr-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-0.5">
          {ARCHIVED_OPTIONS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => handleArchivedChange(value)}
              className={`rounded-md px-2 py-1 text-xs transition-colors ${
                archivedFilter === value
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && data.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
      ) : (
        <>
          <QuestionTable items={data} />

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
