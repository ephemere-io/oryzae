'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { FermentationDetail } from '@/features/shared/fermentation/types';

interface SpFermentationDrawerProps {
  detail: FermentationDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAX_KEYWORDS = 5;
const MAX_SNIPPETS = 3;

type OpenItem =
  | { kind: 'letter'; body: string }
  | { kind: 'keyword'; keyword: string; description: string }
  | { kind: 'snippet'; text: string; sourceDate: string; reason: string };

/**
 * SP エントリー画面の発酵ドロワー（Issue #466 の SP 版）。
 *
 * PC は右サイドバーに集約する。SP には横幅が無いので、docs/entry-screen-design.md §4 の
 * 決定どおり **下からのドロワー**にする。狙いは PC と同じで、発酵結果を本文の上に重ねず、
 * 本文の流れ（原則1）を守ること。
 *
 * 閉じているときは画面下端の細いハンドルだけを出す。開くと手紙・キーワード・スニペットが
 * 並び、項目を押すと本文が展開する（PC の詳細ペインに相当する遷移は SP では作らない
 * ＝画面を積まない）。
 */
export function SpFermentationDrawer({ detail, open, onOpenChange }: SpFermentationDrawerProps) {
  const t = useTranslations('editor.fermentation_sidebar');
  const [openItem, setOpenItem] = useState<OpenItem | null>(null);

  const keywords = detail.keywords.slice(0, MAX_KEYWORDS);
  const snippets = detail.snippets.slice(0, MAX_SNIPPETS);
  const isEmpty = keywords.length === 0 && snippets.length === 0 && detail.letter === null;

  return (
    // 縦のフローに入れる（絶対配置にすると「漬け込む」CTA に重なる）。開いた分だけ
    // 本文側が詰まり、閉じればハンドルの高さしか取らない。
    <div
      className="relative z-20 shrink-0"
      {...verifyAttrs({
        unit: 'SpFermentationDrawer',
        open,
        keywordCount: keywords.length,
        snippetCount: snippets.length,
        hasLetter: detail.letter !== null,
        empty: isEmpty,
        expandedItem: openItem?.kind ?? 'none',
      })}
    >
      {/* 開いている間だけ、背後をタップして閉じられるようにする。 */}
      {open && (
        <button
          type="button"
          aria-label={t('close_aria')}
          onClick={() => onOpenChange(false)}
          className="sp-fade fixed inset-0 z-[-1] bg-black/25"
        />
      )}

      <div
        className="relative rounded-t-2xl border-t border-[var(--border-subtle)] bg-[var(--bg)]"
        style={{
          boxShadow: open ? '0 -8px 24px rgba(0,0,0,0.15)' : 'none',
          maxHeight: open ? '50vh' : undefined,
          overflowY: open ? 'auto' : 'visible',
        }}
      >
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          className="flex w-full items-center justify-center gap-2 px-5 py-2.5 text-xs"
          style={{ color: 'var(--accent)', fontFamily: 'var(--ob-font-sans)' }}
        >
          <span
            aria-hidden="true"
            className="inline-block h-1 w-8 rounded-full"
            style={{ background: 'color-mix(in srgb, var(--accent) 35%, transparent)' }}
          />
          {t('heading')}
        </button>

        {open && (
          <div className="px-5 pb-6">
            {isEmpty && <p className="py-3 text-xs opacity-60">{t('empty')}</p>}

            {detail.letter && (
              <DrawerSection label={t('section_letter')}>
                <DrawerItem
                  onClick={() =>
                    setOpenItem((prev) =>
                      prev?.kind === 'letter'
                        ? null
                        : { kind: 'letter', body: detail.letter?.bodyText ?? '' },
                    )
                  }
                  expanded={openItem?.kind === 'letter'}
                  label={t('letter_open')}
                  body={openItem?.kind === 'letter' ? openItem.body : null}
                />
              </DrawerSection>
            )}

            {keywords.length > 0 && (
              <DrawerSection label={t('section_keywords')}>
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map((kw) => (
                    <button
                      key={kw.id}
                      type="button"
                      onClick={() =>
                        setOpenItem((prev) =>
                          prev?.kind === 'keyword' && prev.keyword === kw.keyword
                            ? null
                            : { kind: 'keyword', keyword: kw.keyword, description: kw.description },
                        )
                      }
                      className="rounded-full px-3 py-1.5 text-xs"
                      style={{
                        background: 'linear-gradient(135deg, #E8D1B5, #D9B48F)',
                        border: '1px solid rgba(255,255,255,0.5)',
                        color: 'var(--fg)',
                      }}
                    >
                      {kw.keyword}
                    </button>
                  ))}
                </div>
                {openItem?.kind === 'keyword' && (
                  <p className="mt-2 text-xs leading-relaxed opacity-75">{openItem.description}</p>
                )}
              </DrawerSection>
            )}

            {snippets.length > 0 && (
              <DrawerSection label={t('section_snippets')}>
                <div className="flex flex-col gap-1.5">
                  {snippets.map((s) => (
                    <DrawerItem
                      key={s.id}
                      onClick={() =>
                        setOpenItem((prev) =>
                          prev?.kind === 'snippet' && prev.text === s.originalText
                            ? null
                            : {
                                kind: 'snippet',
                                text: s.originalText,
                                sourceDate: s.sourceDate,
                                reason: s.selectionReason,
                              },
                        )
                      }
                      expanded={openItem?.kind === 'snippet' && openItem.text === s.originalText}
                      label={s.originalText}
                      body={
                        openItem?.kind === 'snippet' && openItem.text === s.originalText
                          ? openItem.reason
                          : null
                      }
                    />
                  ))}
                </div>
              </DrawerSection>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DrawerSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <div className="mb-1.5 text-[10px] tracking-wider opacity-50">{label}</div>
      {children}
    </section>
  );
}

function DrawerItem({
  onClick,
  expanded,
  label,
  body,
}: {
  onClick: () => void;
  expanded: boolean;
  label: string;
  body: string | null;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        aria-expanded={expanded}
        className="w-full rounded-lg border border-[var(--border-subtle)] px-3 py-2.5 text-left text-xs leading-relaxed"
      >
        {label}
      </button>
      {body !== null && (
        <p className="mt-1.5 whitespace-pre-wrap px-1 text-xs leading-relaxed opacity-75">{body}</p>
      )}
    </div>
  );
}
