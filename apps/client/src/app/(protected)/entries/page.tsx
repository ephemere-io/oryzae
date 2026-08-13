'use client';

import Link from 'next/link';
import { DeviceView } from '@/components/device-view';
import { EntryList } from '@/features/pc/entries/components/entry-list';
import { useFilterableQuestions } from '@/features/shared/questions/hooks/use-filterable-questions';
import { SpEntryList } from '@/features/sp/entries/components/sp-entry-list';
import { useAuth } from '@/lib/auth-context';

export default function EntriesPage() {
  const { api, loading } = useAuth();
  // Issue #331: 一覧の問いフィルタ用の選択肢。取得と整形は共有 hook が持ち、
  // PC/SP の一覧へ同じものを渡す（二重 fetch を避ける）。
  const availableQuestions = useFilterableQuestions(api);

  return (
    <DeviceView
      sp={<SpEntryList api={api} availableQuestions={availableQuestions} />}
      pc={
        <div className="flex min-h-full flex-col">
          <div className="mx-auto w-full max-w-[680px] flex-1 px-6 pt-10 pb-20">
            {/* Header: ALL ENTRIES left, + NEW ENTRY right */}
            <div className="mb-8 flex items-center justify-between">
              <h2
                className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--date-color)]"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                All Entries
              </h2>
              <Link
                href="/entries/new"
                className="rounded-full border border-[var(--accent)] bg-transparent px-5 py-2 text-xs font-medium uppercase tracking-[0.1em] text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-white"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                + New Entry
              </Link>
            </div>

            <EntryList api={api} authLoading={loading} availableQuestions={availableQuestions} />
          </div>
        </div>
      }
    />
  );
}
