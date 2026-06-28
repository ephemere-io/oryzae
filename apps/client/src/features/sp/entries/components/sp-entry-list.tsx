'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useEntries } from '@/features/shared/entries/hooks/use-entries';
import { useActiveQuestions } from '@/features/shared/entry-questions/hooks/use-entry-questions';
import type { ApiClient } from '@/lib/api';

interface SpEntryListProps {
  api: ApiClient | null;
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
 * 左上アバターからアカウント（ボトムナビにアカウントを置かない構成のため）。
 */
export function SpEntryList({ api }: SpEntryListProps) {
  const t = useTranslations('sp.list');
  const router = useRouter();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState<string | undefined>();
  const [questionFilter, setQuestionFilter] = useState('');
  const questionId = questionFilter || undefined;

  // 入力を 300ms デバウンスして検索する（PC の useDebounce 相当を内製）。
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim() || undefined), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const activeQuestions = useActiveQuestions(api, false);
  const { entries, loading } = useEntries(api, false, search, questionId);

  const isFiltering = !!search || !!questionId;

  return (
    <div className="flex h-full flex-col bg-[var(--bg)] text-[var(--fg)]">
      <header className="flex items-center gap-3 px-5 pt-5 pb-3">
        <Link
          href="/account"
          aria-label={t('account')}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
          style={{ background: 'var(--accent)' }}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <title>account</title>
            <circle cx="12" cy="8" r="3.2" />
            <path d="M5 20c0-3.3 3.1-5 7-5s7 1.7 7 5" strokeLinecap="round" />
          </svg>
        </Link>
        <span className="text-lg font-medium" style={{ fontFamily: 'var(--ob-font-serif, serif)' }}>
          {t('title')}
        </span>
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

      {loading ? null : entries.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm opacity-50">
          {isFiltering ? t('empty_filtered') : t('empty')}
        </div>
      ) : (
        <ul className="mt-1 flex-1 overflow-auto px-5">
          {entries.map((entry) => {
            const title = firstLine(entry.content) || t('untitled');
            const q = entry.linkedQuestions[0];
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/entries/${entry.id}`)}
                  className="w-full border-b border-[color-mix(in_srgb,var(--fg)_6%,transparent)] py-4 text-left"
                >
                  <span
                    className="block truncate text-[15px] font-medium"
                    style={{ fontFamily: 'var(--ob-font-serif, serif)' }}
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
              </li>
            );
          })}
        </ul>
      )}
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
