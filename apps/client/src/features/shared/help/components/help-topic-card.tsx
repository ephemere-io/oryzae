'use client';

import { verifyAttrs } from '@oryzae/verify';
import { CONTROL_FONT, HOVER_CLASS, ICON_STROKE_WIDTH } from '@/components/ui/surface';
import type { HelpTopic, HelpTopicText } from '../types';
import { HelpIllustration } from './help-illustrations';

export interface HelpTopicCardProps {
  topic: HelpTopic;
  text: HelpTopicText;
  expanded: boolean;
  onToggle: () => void;
  /** 「開く」の文言。行き先が無い話題では出ない。 */
  openLabel: string;
  onOpen: (href: string, external: boolean) => void;
  /** 題の隣に添える印（Jev が選んだ「おすすめ」）。 */
  badge?: string;
}

/**
 * 一覧の話題 1 件。
 *
 * 閉じているときは**行**（小さな線画・題・一言）。押すと本文と「開く」が、行の下から
 * 伸びて出る。一覧は目で流すものなので、行は面を持たず地に直接置く（浮かせるのは面の頭の
 * 1 枚だけ）。
 *
 * ## 伸び縮み
 *
 * 本文は常に DOM に居て、`grid-template-rows` を 0fr ⇄ 1fr で遷移させる（高さを測らずに
 * 滑らかに伸び縮みする、CSS だけの作り）。閉じている間は `inert` にして、読み上げにも
 * Tab にも掛からないようにする。
 *
 * ## 余白
 *
 * 行の上下は 8px、開いた本文の下は 8px。行の外に余白を持たせない — 束の間の空きは
 * 一覧側の区切り線が受け持つ。開いた行の下だけ広い、瓶の上だけ広い、といった
 * 不揃いはここから生まれていた。
 */
export function HelpTopicCard({
  topic,
  text,
  expanded,
  onToggle,
  openLabel,
  onOpen,
  badge,
}: HelpTopicCardProps) {
  return (
    <div
      className="rounded-[10px]"
      style={CONTROL_FONT}
      {...verifyAttrs({
        unit: 'HelpTopicCard',
        topic: topic.id,
        expanded,
        hasHref: topic.href !== null,
        badge: badge ?? '',
      })}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={`flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left ${HOVER_CLASS}`}
      >
        <span className="flex w-8 shrink-0 justify-center text-[var(--fg)]">
          <HelpIllustration kind={topic.illustration} size={30} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span className="truncate text-[13px] text-[var(--fg)]">{text.title}</span>
            {badge && (
              <span
                className="shrink-0 rounded-full border px-1.5 py-px text-[9px] tracking-[0.08em]"
                style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
              >
                {badge}
              </span>
            )}
          </span>
          {/* 一言は 2 行まで。1 行で切ると「保存は勝…」のように途中で欠ける。 */}
          <span className="line-clamp-2 text-[11px] leading-[1.5] text-[var(--date-color)]">
            {text.lead}
          </span>
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={ICON_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-3.5 w-3.5 shrink-0 text-[var(--date-color)] transition-transform duration-200 ${
            expanded ? 'rotate-90' : ''
          }`}
        >
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div
          className={`min-h-0 overflow-hidden transition-opacity duration-200 ${expanded ? 'opacity-100' : 'opacity-0'}`}
          inert={!expanded}
          aria-hidden={!expanded}
          data-help-body=""
        >
          <div className="flex flex-col gap-2.5 pt-0.5 pr-3 pb-2 pl-[3.25rem]">
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
        </div>
      </div>
    </div>
  );
}
