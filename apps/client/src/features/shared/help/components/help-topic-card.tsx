'use client';

import { verifyAttrs } from '@oryzae/verify';
import { CONTROL_FONT, HOVER_CLASS, ICON_STROKE_WIDTH } from '@/components/ui/surface';
import type { HelpTopic, HelpTopicText } from '../types';
import { HelpIllustration } from './help-illustrations';

export interface HelpTopicCardProps {
  topic: HelpTopic;
  text: HelpTopicText;
  /** 本文まで開いているか。閉じていれば題と一言だけ。 */
  expanded: boolean;
  onToggle: () => void;
  /** 「開く」の文言。行き先が無い話題では出ない。 */
  openLabel: string;
  onOpen: (href: string, external: boolean) => void;
  /** 題の隣に添える印（Jev が選んだ「おすすめ」など）。 */
  badge?: string;
  /** 常に開いた**紙の面**で出す（いま触れているもの）。押しても畳まない。 */
  spot?: boolean;
}

/**
 * 話題 1 件。
 *
 * 閉じているときは**行**（題 + 一言）。押すと本文と線画と「開く」が出る。一覧の中で
 * 1 件ずつ読めるように、面は持たず地に直接置く。**いま触れているもの**だけは紙の面
 * （`--surface-raised`）に載せて、一覧と区別する。
 */
export function HelpTopicCard({
  topic,
  text,
  expanded,
  onToggle,
  openLabel,
  onOpen,
  badge,
  spot = false,
}: HelpTopicCardProps) {
  const open = spot || expanded;
  const contract = verifyAttrs({
    unit: 'HelpTopicCard',
    topic: topic.id,
    expanded: open,
    spot,
    hasHref: topic.href !== null,
    badge: badge ?? '',
  });

  const heading = (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="flex items-center gap-2">
        <span className="truncate text-[13px] font-medium text-[var(--fg)]">{text.title}</span>
        {badge && (
          <span
            className="shrink-0 rounded-full border px-1.5 py-px text-[9px] tracking-[0.08em]"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
          >
            {badge}
          </span>
        )}
      </span>
      <span className="text-[11px] leading-[1.5] text-[var(--date-color)]">{text.lead}</span>
    </span>
  );

  const detail = open && (
    <div className="flex flex-col gap-3 pt-3">
      <HelpIllustration kind={topic.illustration} />
      <p className="text-[12.5px] leading-[1.8] text-[var(--fg)] opacity-85">{text.body}</p>
      {topic.href !== null && (
        <button
          type="button"
          onClick={() => onOpen(topic.href ?? '', topic.external === true)}
          className="self-start text-[12px] underline-offset-2 hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          {openLabel} {topic.external ? '↗' : '→'}
        </button>
      )}
    </div>
  );

  if (spot) {
    return (
      <div
        className="rounded-[12px] border px-4 py-3"
        style={{
          background: 'var(--surface-raised)',
          borderColor: 'var(--surface-raised-border)',
          ...CONTROL_FONT,
        }}
        {...contract}
      >
        <div className="flex items-start gap-3">{heading}</div>
        {detail}
      </div>
    );
  }

  return (
    <div className="rounded-[12px]" style={CONTROL_FONT} {...contract}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`flex w-full items-start gap-3 rounded-[12px] px-3 py-2.5 text-left ${HOVER_CLASS}`}
      >
        {heading}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={ICON_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`mt-1 h-3.5 w-3.5 shrink-0 text-[var(--date-color)] transition-transform duration-150 ${
            open ? 'rotate-90' : ''
          }`}
        >
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
      {open && <div className="px-3 pb-3">{detail}</div>}
    </div>
  );
}
