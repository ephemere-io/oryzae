'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { useDeleteEntry } from '@/features/shared/entries/hooks/use-delete-entry';
import { type EntryListOrder, useEntries } from '@/features/shared/entries/hooks/use-entries';
import type { ApiClient } from '@/lib/api';
import { SpConfirmSheet } from './sp-confirm-sheet';

interface SpEntryListProps {
  api: ApiClient | null;
  /** 問いフィルタ用の選択肢。page の useQuestions から渡す（重複 fetch を避ける）。 */
  availableQuestions?: { id: string; currentText: string | null }[];
}

/** content の先頭行をタイトル代わりに使う（エディタの保存形式: 先頭行=タイトル）。 */
function firstLine(content: string): string {
  const idx = content.indexOf('\n');
  return (idx === -1 ? content : content.slice(0, idx)).trim();
}

/** ISO 日付を「M月D日」に。失敗時は空。 */
function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * SP 版エントリ一覧（Issue #363）。PC 同等に検索・問いで絞り込みを備える。
 * タップで詳細（/entries/[id]）へ遷移し、SP エディタで読み＋編集する。
 * アカウント等への移動はボトムナビから。
 */
export function SpEntryList({ api, availableQuestions = [] }: SpEntryListProps) {
  const t = useTranslations('sp.list');
  const tDelete = useTranslations('entries.delete_modal');
  const router = useRouter();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState<string | undefined>();
  const [questionFilter, setQuestionFilter] = useState('');
  const questionId = questionFilter || undefined;
  const [order, setOrder] = useState<EntryListOrder>('newest');
  // 削除対象（行の ⋯ で選んだエントリ）。null なら確認シートは閉じている。
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // 入力を 300ms デバウンスして検索する（PC の useDebounce 相当を内製）。
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim() || undefined), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const activeQuestions = availableQuestions;
  // Issue #362: useEntries は optimistic 化で authLoading 引数を撤去済み（api, search?, questionId?）。
  const { entries, loading, removeEntry } = useEntries(api, search, questionId, order);
  const { deleteEntry, deleting } = useDeleteEntry(api);

  const isFiltering = !!search || !!questionId;

  // 確認シートで「削除する」→ API 削除が成功したら一覧から楽観的に取り除く。
  async function handleDelete() {
    if (!deleteId) return;
    const ok = await deleteEntry(deleteId);
    if (ok) removeEntry(deleteId);
    setDeleteId(null);
  }

  return (
    <div
      className="flex h-full flex-col bg-[var(--bg)] text-[var(--fg)]"
      {...verifyAttrs({
        unit: 'SpEntryList',
        loading,
        count: entries.length,
        hasQuestions: activeQuestions.length > 0,
        order,
        deleteOpen: deleteId !== null,
      })}
    >
      <header className="flex items-center justify-between px-5 pt-6 pb-3">
        <span className="text-lg font-medium" style={{ fontFamily: 'var(--ob-font-serif)' }}>
          {t('title')}
        </span>
        {/* 作成日のソート順トグル（新しい順 ⇄ 古い順）。サーバー側 created_at 並び替えに対応。 */}
        <button
          type="button"
          id="sp-entries-sort-toggle"
          onClick={() => setOrder((o) => (o === 'newest' ? 'oldest' : 'newest'))}
          aria-label={t('sort_label')}
          className="flex shrink-0 items-center gap-1 text-[12px] text-[var(--date-color)]"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <title>sort</title>
            <path
              d="M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {order === 'newest' ? t('sort_newest') : t('sort_oldest')}
        </button>
      </header>

      {/* 検索 */}
      <div className="px-5">
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2.5"
          style={{
            background: 'color-mix(in srgb, var(--fg) 4%, transparent)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--date-color)"
            strokeWidth="2"
            aria-hidden="true"
          >
            <title>search</title>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3-3" strokeLinecap="round" />
          </svg>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('search')}
            aria-label={t('search')}
            className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--date-color)]"
          />
          {searchInput ? (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              aria-label={t('search_clear')}
              className="text-[var(--date-color)]"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <title>clear</title>
                <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      {/* 問いで絞り込み（チップ） */}
      {activeQuestions.length > 0 ? (
        <div
          className="mt-3 flex gap-2 overflow-x-auto px-5 pb-1"
          style={{ scrollbarWidth: 'none' }}
        >
          <FilterChip on={questionFilter === ''} onClick={() => setQuestionFilter('')}>
            {t('all')}
          </FilterChip>
          {activeQuestions.map((q) => (
            <FilterChip
              key={q.id}
              on={questionFilter === q.id}
              onClick={() => setQuestionFilter(questionFilter === q.id ? '' : q.id)}
            >
              {q.currentText ?? t('untitled')}
            </FilterChip>
          ))}
        </div>
      ) : null}

      {loading ? (
        <ListSkeleton />
      ) : entries.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm opacity-50">
          {isFiltering ? t('empty_filtered') : t('empty')}
        </div>
      ) : (
        <ul className="sp-rise mt-1 flex-1 overflow-auto px-5">
          {entries.map((entry) => {
            const title = firstLine(entry.content) || t('untitled');
            const q = entry.linkedQuestions[0];
            return (
              <li
                key={entry.id}
                className="flex items-center gap-1 border-b border-[color-mix(in_srgb,var(--fg)_6%,transparent)]"
              >
                {/* タップで詳細へ。削除ボタンと入れ子にならないよう行を flex に分割。 */}
                <button
                  type="button"
                  onClick={() => router.push(`/entries/${entry.id}`)}
                  className="min-w-0 flex-1 py-4 text-left"
                >
                  <span
                    className="block truncate text-[15px] font-medium"
                    style={{ fontFamily: 'var(--ob-font-serif)' }}
                  >
                    {title}
                  </span>
                  <span className="mt-1.5 flex items-center gap-2.5 text-[11px] text-[var(--date-color)]">
                    <span>{formatDate(entry.createdAt)}</span>
                    {q ? (
                      <span style={{ color: 'var(--accent)' }}>
                        ◦ {q.currentText ?? t('untitled')}
                      </span>
                    ) : null}
                  </span>
                </button>
                {/* 行の削除トリガー（⋯）→ 確認シートを開く */}
                <button
                  type="button"
                  onClick={() => setDeleteId(entry.id)}
                  aria-label={t('delete')}
                  className="shrink-0 p-2 text-[var(--date-color)]"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <title>more</title>
                    <circle cx="12" cy="5" r="1.6" />
                    <circle cx="12" cy="12" r="1.6" />
                    <circle cx="12" cy="19" r="1.6" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <SpConfirmSheet
        open={deleteId !== null}
        title={tDelete('heading')}
        message={tDelete('body')}
        confirmLabel={tDelete('confirm')}
        cancelLabel={tDelete('cancel')}
        destructive
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

function FilterChip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[11.5px]"
      style={
        on
          ? { background: 'var(--fg)', color: 'var(--bg)', border: '1px solid var(--fg)' }
          : {
              background: 'var(--bg)',
              color: 'var(--date-color)',
              border: '1px solid var(--border-subtle)',
            }
      }
    >
      {children}
    </button>
  );
}
