'use client';

import Link from 'next/link';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { EntryList } from '@/features/entries/components/entry-list';

export default function EntriesPage() {
  const { api, loading } = useAuth();

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1">
        <div className="flex flex-col gap-6">
          {/* Header matching reference UI */}
          <div className="flex items-center justify-center gap-3">
            <span
              className="text-sm font-medium uppercase tracking-[0.12em] text-[var(--date-color)]"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              All Entries
            </span>
            <Link
              href="/entries/new"
              className="rounded-full border border-[var(--accent)] px-5 py-1.5 text-sm font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-white"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              + New Entry
            </Link>
          </div>

          <EntryList api={api} authLoading={loading} />
        </div>
      </div>

      {/* Footer matching reference UI */}
      <footer className="sticky bottom-0 flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--bg)] px-4 py-1.5 text-xs text-[var(--date-color)]">
        <div className="flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--date-color)] opacity-30" />
          <span style={{ fontFamily: 'Inter, sans-serif' }}>LIST</span>
        </div>
      </footer>
    </div>
  );
}
