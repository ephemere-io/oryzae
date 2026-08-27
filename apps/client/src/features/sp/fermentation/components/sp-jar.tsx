'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useFermentationDetail } from '@/features/shared/fermentation/hooks/use-fermentation-detail';
import { useFermentationInbox } from '@/features/shared/fermentation/hooks/use-fermentation-inbox';
import type { InboxLetter } from '@/features/shared/fermentation/types';
import { SpJarRowsSkeleton } from '@/features/sp/fermentation/components/sp-jar-skeleton';
import type { ApiClient } from '@/lib/api';
import { formatMonthDay } from '@/lib/format-date';
import { useUnread } from '@/lib/unread-context';

interface SpJarProps {
  api: ApiClient | null;
}

/**
 * SP 版「瓶」= 発酵の結果を読む場所（Issue #363）。問いごとに、届いた発酵を
 * 一覧（未読/既読を明示）→ タップで 手紙・言葉(keywords)・抜粋(snippets) を読む
 * →「返事を書く」。PC のドラッグ盤面・アニメーションは持たない（モバイル向けに簡略）。
 */
export function SpJar({ api }: SpJarProps) {
  const t = useTranslations('sp.jar');
  const router = useRouter();
  const { letters, loading } = useFermentationInbox(api, false);
  const { ready: unreadReady, unreadQuestionIds, markQuestionRead } = useUnread();
  const [open, setOpen] = useState<InboxLetter | null>(null);
  const { detail, loading: detailLoading } = useFermentationDetail(
    api,
    open?.fermentationId ?? null,
  );

  return (
    <div
      className="relative flex h-full flex-col bg-[var(--bg)] text-[var(--fg)]"
      style={{ fontFamily: 'var(--ob-font-serif)' }}
      {...verifyAttrs({
        unit: 'SpJar',
        loading,
        letterCount: letters.length,
        open: open !== null,
        unreadCount: unreadReady
          ? letters.filter((l) => unreadQuestionIds.has(l.questionId)).length
          : 0,
      })}
    >
      <header className="px-5 pt-6 pb-3 text-lg font-medium">{t('title')}</header>

      {loading ? (
        <SpJarRowsSkeleton />
      ) : letters.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm opacity-50">{t('empty')}</div>
      ) : (
        <ul className="sp-rise flex-1 overflow-auto px-5">
          {letters.map((letter) => {
            // Issue #447: 既読は「瓶を開いた時刻」ではなく「その手紙を開いたか」で決める。
            const unread = unreadReady && unreadQuestionIds.has(letter.questionId);
            return (
              <li key={letter.fermentationId}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(letter);
                    markQuestionRead(letter.questionId);
                  }}
                  className="flex w-full items-center gap-3 border-b border-[color-mix(in_srgb,var(--fg)_8%,transparent)] py-4 text-left"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: unread ? 'var(--ob-jar-warm)' : 'transparent' }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate ${unread ? 'font-medium' : ''}`}>
                      {letter.questionText ?? t('untitled')}
                    </span>
                    <span
                      className="mt-0.5 block text-[11px]"
                      style={{ color: 'var(--date-color)' }}
                    >
                      {unreadReady ? `${unread ? t('unread') : t('read')} · ` : ''}
                      {formatMonthDay(letter.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {open ? (
        <div className="sp-rise absolute inset-0 z-10 flex flex-col bg-[var(--bg)]">
          <header
            className="flex items-center justify-between gap-3 px-5 py-4 text-xs"
            style={{ color: 'var(--date-color)' }}
          >
            <span className="truncate">◦ {open.questionText ?? t('untitled')}</span>
            <button type="button" onClick={() => setOpen(null)} className="shrink-0">
              {t('close')}
            </button>
          </header>

          <div className="flex-1 overflow-auto px-6 pb-6">
            {/* 手紙 */}
            <SectionLabel>{t('section_letter')}</SectionLabel>
            <p className="whitespace-pre-wrap text-base leading-loose">
              {detailLoading ? '' : (detail?.letter?.bodyText ?? t('letter_empty'))}
            </p>

            {/* 言葉（keywords） */}
            {detail && detail.keywords.length > 0 ? (
              <>
                <SectionLabel>{t('section_keywords')}</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {detail.keywords.map((k) => (
                    <span
                      key={k.id}
                      className="rounded-full px-3 py-1 text-xs"
                      style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
                    >
                      {k.keyword}
                    </span>
                  ))}
                </div>
              </>
            ) : null}

            {/* 抜粋（snippets） */}
            {detail && detail.snippets.length > 0 ? (
              <>
                <SectionLabel>{t('section_snippets')}</SectionLabel>
                <div className="flex flex-col gap-3">
                  {detail.snippets.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-xl p-3"
                      style={{
                        background: 'var(--ob-card-bg)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <p className="text-sm leading-relaxed">「{s.originalText}」</p>
                      <p className="mt-1.5 text-[11px]" style={{ color: 'var(--date-color)' }}>
                        {formatMonthDay(s.sourceDate)}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          <footer className="px-5 py-4">
            <button
              type="button"
              onClick={() => router.push(`/entries/new?questionId=${open.questionId}`)}
              className="w-full rounded-full py-3 text-center text-sm font-medium text-white"
              style={{ background: 'var(--accent)', fontFamily: 'var(--ob-font-sans)' }}
            >
              {t('reply')}
            </button>
          </footer>
        </div>
      ) : null}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mt-6 mb-2 text-[11px] uppercase tracking-[0.14em] first:mt-2"
      style={{ color: 'var(--accent)', fontFamily: 'var(--ob-font-sans)' }}
    >
      {children}
    </p>
  );
}
