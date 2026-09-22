'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { CONTROL_FONT, ICON_STROKE_WIDTH } from '@/components/ui/surface';
import { HELP_PANEL_ATTR } from '../hover';
import { HELP_SECTIONS, HELP_TOPICS, helpTopic } from '../topics';
import type { HelpMatch, HelpRemoteState, HelpTopicId, HelpTopicText } from '../types';
import { HelpTopicCard } from './help-topic-card';

export interface HelpPanelProps {
  texts: readonly HelpTopicText[];
  /** いま触れているもの。無ければ `screenTopic` を出す。 */
  hovered: HelpTopicId | null;
  /** いま開いている画面の話題。 */
  screenTopic: HelpTopicId;
  focused: HelpTopicId | null;
  onFocus: (topic: HelpTopicId | null) => void;
  query: string;
  onQueryChange: (query: string) => void;
  matches: readonly HelpMatch[];
  remote: HelpRemoteState;
  /** 初めての人に自動で開いた回。上に「ようこそ」を添える。 */
  firstVisit: boolean;
  /** `?` の案内を出すか（キーボードのある端末だけ）。 */
  shortcutHint: boolean;
  onClose: () => void;
  /** 「開く」。アプリの中は router、外は新しいタブ — 決めるのは呼び出し側。 */
  onOpenHref: (href: string, external: boolean) => void;
}

/**
 * ヘルプの面の中身（`docs/help-mode-guide.md`）。PC の右の面と SP のシートが共有する。
 *
 * 上から: 検索欄 → いま触れているもの（無ければ、いま開いている画面）→ 話題の一覧
 * （はじめに／書斎のもの／画面／困ったとき）。検索欄に何か書いている間は、一覧の代わりに
 * 近い話題だけを出す。
 *
 * **データは持たない。** 触れているもの・検索の結果は props で受ける（孤立検証のため）。
 */
export function HelpPanel({
  texts,
  hovered,
  screenTopic,
  focused,
  onFocus,
  query,
  onQueryChange,
  matches,
  remote,
  firstVisit,
  shortcutHint,
  onClose,
  onOpenHref,
}: HelpPanelProps) {
  const t = useTranslations('help');
  const searchId = useId();
  const searching = query.trim().length > 0;
  const textOf = new Map(texts.map((text) => [text.id, text]));
  const spot = hovered ?? screenTopic;
  const spotText = textOf.get(spot);

  return (
    <div
      {...{ [HELP_PANEL_ATTR]: '' }}
      {...verifyAttrs({
        unit: 'HelpPanel',
        mode: searching ? 'search' : 'browse',
        spot,
        spotKind: hovered ? 'hover' : 'screen',
        focused: focused ?? 'none',
        resultCount: searching ? matches.length : -1,
        remote,
        firstVisit,
      })}
      className="flex h-full min-h-0 flex-col"
      style={CONTROL_FONT}
    >
      {/* 面の始まりを示す 1 行。発酵の面と同じ作法（名前は薄く、閉じるは右）。 */}
      <div className="mb-3 flex h-6 shrink-0 items-center gap-2 px-5">
        <span className="flex-1 truncate text-[11px] font-medium tracking-[0.12em] text-[var(--fg)] opacity-45">
          {t('title')}
        </span>
        {shortcutHint && (
          <kbd
            className="rounded border px-1 text-[10px] leading-4 text-[var(--date-color)]"
            style={{ borderColor: 'var(--border-subtle)' }}
            title={t('shortcut_hint')}
          >
            ?
          </kbd>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="-mr-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--date-color)] transition-colors duration-150 hover:bg-[var(--hover-wash)] hover:text-[var(--fg)]"
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={ICON_STROKE_WIDTH}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {/* 検索欄。したいことを書く。 */}
      <div className="shrink-0 px-5">
        <label
          htmlFor={searchId}
          className="flex items-center gap-2 border-b pb-2"
          style={{ borderColor: 'var(--surface-sunken-border)' }}
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-[var(--date-color)]"
            fill="none"
            stroke="currentColor"
            strokeWidth={ICON_STROKE_WIDTH}
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="m20 20-3.5-3.5" />
          </svg>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t('search_placeholder')}
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--fg)] outline-none placeholder:text-[var(--date-color)]"
          />
          {searching && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              aria-label={t('search_clear')}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--date-color)] hover:text-[var(--fg)]"
            >
              <svg
                aria-hidden="true"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth={ICON_STROKE_WIDTH}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </label>
        {!searching && (
          <p className="mt-1.5 text-[10.5px] text-[var(--date-color)]">{t('search_hint')}</p>
        )}
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-3 pb-5">
        {searching ? (
          <div className="flex flex-col gap-1">
            {matches.length === 0 ? (
              <p className="px-2 py-3 text-[12px] leading-[1.7] text-[var(--date-color)]">
                {remote === 'asking' ? t('search_asking') : t('search_empty')}
              </p>
            ) : (
              matches.map((match, index) => {
                const text = textOf.get(match.id);
                if (!text) return null;
                return (
                  <HelpTopicCard
                    key={match.id}
                    topic={helpTopic(match.id)}
                    text={text}
                    // 検索の 1 件目は開いておく。押して読むまでの手数を減らす。
                    expanded={focused === match.id || (focused === null && index === 0)}
                    onToggle={() => onFocus(focused === match.id ? null : match.id)}
                    openLabel={t('open_topic')}
                    onOpen={onOpenHref}
                    badge={match.source === 'jev' ? t('pick_badge') : undefined}
                  />
                );
              })
            )}
            {remote === 'asking' && matches.length > 0 && (
              <p className="px-2 pt-1 text-[10.5px] text-[var(--date-color)]">
                {t('search_asking')}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* いま触れているもの／いま開いている画面。 */}
            {spotText && (
              <section className="flex flex-col gap-2 px-1">
                <h3 className="px-1 text-[10px] font-medium tracking-[0.12em] text-[var(--date-color)] uppercase">
                  {hovered ? t('hover_title') : t('here_title')}
                </h3>
                <HelpTopicCard
                  spot
                  topic={helpTopic(spot)}
                  text={spotText}
                  expanded
                  onToggle={() => {}}
                  openLabel={t('open_topic')}
                  onOpen={onOpenHref}
                />
                {!hovered && (
                  <p className="px-1 text-[10.5px] leading-[1.6] text-[var(--date-color)]">
                    {t('hover_idle')}
                  </p>
                )}
              </section>
            )}

            {firstVisit && (
              <section className="px-2">
                <p className="text-[13px] font-medium text-[var(--fg)]">{t('welcome_title')}</p>
                <p className="mt-1 text-[12px] leading-[1.7] text-[var(--date-color)]">
                  {t('welcome_body')}
                </p>
              </section>
            )}

            {HELP_SECTIONS.map((section) => (
              <section key={section} className="flex flex-col gap-0.5">
                <h3 className="mb-1 px-3 text-[10px] font-medium tracking-[0.12em] text-[var(--date-color)] uppercase">
                  {t(`section.${section}`)}
                </h3>
                {HELP_TOPICS.filter((topic) => topic.section === section).map((topic) => {
                  const text = textOf.get(topic.id);
                  if (!text) return null;
                  return (
                    <HelpTopicCard
                      key={topic.id}
                      topic={topic}
                      text={text}
                      expanded={focused === topic.id}
                      onToggle={() => onFocus(focused === topic.id ? null : topic.id)}
                      openLabel={t('open_topic')}
                      onOpen={onOpenHref}
                    />
                  );
                })}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
