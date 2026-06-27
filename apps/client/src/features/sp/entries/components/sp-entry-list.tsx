'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
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
 * SP 版エントリ一覧（Issue #363）。過去エントリを軽く振り返るための受信箱的リスト。
 * 各行をタップで全画面の読みビュー（content は一覧取得時に含まれるので追加取得なし）。
 * 既存エントリの編集は当面 PC（SP は読み中心）。
 */
export function SpEntryList({ api }: SpEntryListProps) {
  const t = useTranslations('sp.list');
  const { entries, loading } = useEntries(api, false);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = entries.find((e) => e.id === openId) ?? null;

  return (
    <div className="relative flex h-full flex-col bg-[var(--bg)] text-[var(--fg)]">
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
                  onClick={() => setOpenId(entry.id)}
                  className="w-full border-b border-[color-mix(in_srgb,var(--fg)_8%,transparent)] px-5 py-4 text-left"
                >
                  <span className="block truncate">{title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {open ? (
        <div className="absolute inset-0 z-10 flex flex-col bg-[var(--bg)]">
          <header className="flex items-center justify-end px-5 py-4 text-xs opacity-60">
            <button type="button" onClick={() => setOpenId(null)}>
              {t('close')}
            </button>
          </header>
          <div className="flex-1 overflow-auto whitespace-pre-wrap px-6 py-4 text-base leading-relaxed">
            {open.content}
          </div>
        </div>
      ) : null}
    </div>
  );
}
