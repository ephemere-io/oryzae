'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEntries } from '@/features/shared/entries/hooks/use-entries';
import type { ApiClient } from '@/lib/api';

interface SpEntryListProps {
  api: ApiClient | null;
}

/** content の先頭行をタイトル代わりに使う（エディタの保存形式: 先頭行=タイトル）。 */
function firstLine(content: string): string {
  const idx = content.indexOf('\n');
  return (idx === -1 ? content : content.slice(0, idx)).trim();
}

/**
 * SP 版エントリ一覧（Issue #363）。過去エントリをタップで詳細（/entries/[id]）へ。
 * 詳細は SP エディタ＝そのまま読み＋編集（自動保存で更新）。
 */
export function SpEntryList({ api }: SpEntryListProps) {
  const t = useTranslations('sp.list');
  const router = useRouter();
  const { entries, loading } = useEntries(api, false);

  return (
    <div className="flex h-full flex-col bg-[var(--bg)] text-[var(--fg)]">
      <header className="px-5 pt-6 pb-3 text-lg font-medium">{t('title')}</header>

      {loading ? null : entries.length === 0 ? (
        <div className="px-5 py-10 text-sm opacity-50">{t('empty')}</div>
      ) : (
        <ul className="flex-1 overflow-auto">
          {entries.map((entry) => {
            const title = firstLine(entry.content) || t('untitled');
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/entries/${entry.id}`)}
                  className="w-full border-b border-[color-mix(in_srgb,var(--fg)_8%,transparent)] px-5 py-4 text-left"
                >
                  <span className="block truncate">{title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
