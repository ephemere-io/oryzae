'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import {
  type InboxLetter,
  useFermentationInbox,
  useFermentationLetter,
} from '@/features/shared/fermentation/hooks/use-fermentation-inbox';
import type { ApiClient } from '@/lib/api';
import { useUnread } from '@/lib/unread-context';

interface SpJarProps {
  api: ApiClient | null;
}

/**
 * SP 版「瓶」= 届いた手紙の受信箱（Issue #363）。
 * 全問いの完了発酵を一覧 → タップで手紙を全画面で読む → その場で「返事を書く」
 * （/entries/new?questionId=… ＝ SP エディタで当該の問いが自動紐づく）。
 * PC の瓶（ドラッグ配置のキャンバス）は持たず、軽量な受信箱に簡略化。
 */
export function SpJar({ api }: SpJarProps) {
  const t = useTranslations('sp.jar');
  const router = useRouter();
  const { letters, loading } = useFermentationInbox(api, false);
  const { markSeen } = useUnread();
  const [open, setOpen] = useState<InboxLetter | null>(null);
  const { bodyText, loading: letterLoading } = useFermentationLetter(
    api,
    open?.fermentationId ?? null,
  );

  // 瓶を開いたら未読バッジを既読化する
  useEffect(() => {
    markSeen();
  }, [markSeen]);

  return (
    <div className="relative flex h-full flex-col bg-[var(--bg)] text-[var(--fg)]">
      <header className="px-5 pt-6 pb-3 text-lg font-medium">{t('title')}</header>

      {loading ? null : letters.length === 0 ? (
        <div className="px-5 py-10 text-sm opacity-50">{t('empty')}</div>
      ) : (
        <ul className="flex-1 overflow-auto">
          {letters.map((letter) => (
            <li key={letter.fermentationId}>
              <button
                type="button"
                onClick={() => setOpen(letter)}
                className="w-full border-b border-[color-mix(in_srgb,var(--fg)_8%,transparent)] px-5 py-4 text-left"
              >
                <span className="block truncate">{letter.questionText ?? t('untitled')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <div className="absolute inset-0 z-10 flex flex-col bg-[var(--bg)]">
          <header className="flex items-center justify-between gap-3 px-5 py-4 text-xs opacity-60">
            <span className="truncate">{open.questionText ?? t('untitled')}</span>
            <button type="button" onClick={() => setOpen(null)} className="shrink-0">
              {t('close')}
            </button>
          </header>
          <div className="flex-1 overflow-auto whitespace-pre-wrap px-6 py-4 font-serif text-base leading-loose">
            {letterLoading ? '' : (bodyText ?? t('letter_empty'))}
          </div>
          <footer className="px-5 py-4">
            <button
              type="button"
              onClick={() => router.push(`/entries/new?questionId=${open.questionId}`)}
              className="w-full rounded-full border border-[color-mix(in_srgb,var(--fg)_24%,transparent)] py-3 text-center"
            >
              {t('reply')}
            </button>
          </footer>
        </div>
      ) : null}
    </div>
  );
}
