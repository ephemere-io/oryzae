'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { CONTROL_FONT } from '@/components/ui/surface';
import { isHelpTopicId } from '../topics';
import type { HelpTopic, HelpTopicId, HelpTopicText } from '../types';
import { HelpIllustration } from './help-illustrations';
import { HelpStudyMap } from './help-study-map';

export interface HelpScreenCardProps {
  /** いま開いている画面の話題。 */
  screen: HelpTopic;
  /** 画面の中の部品（話題）。書斎なら瓶・手帳・板・棚・鉛筆。無ければ本文だけ。 */
  parts: readonly HelpTopic[];
  texts: ReadonlyMap<HelpTopicId, HelpTopicText>;
  /**
   * 画面の中で触れているもの。部品の 1 つなら、その札が灯って説明が開く。
   * 部品でなければ何も起きない（1 枚は入れ替わらない）。
   */
  hovered: HelpTopicId | null;
}

/**
 * 面の頭の 1 枚 — **いま開いている画面**の説明。
 *
 * 前の版は触れているものをそのまま映していて、ポインタが物をまたぐたびに 1 枚ごと
 * 入れ替わった。「何もしていないのに勝手に変わって注意を奪われる」。いまは画面ごとに
 * 1 枚が決まっていて、その中に画面の部品の札（書斎なら縮小図）が並ぶ。画面の中で瓶に
 * 触れると瓶の札が灯って説明が開き、面の中で札に触れても同じことが起きる。1 枚そのものは
 * 画面を移るまで変わらない。
 *
 * 札を押すと、その札を留める（触れを離しても開いたまま）。もう一度押すと外す。
 * 「開く」のボタンは置かない — 行き先へは下の一覧から。
 */
/** 書斎の物 → 3D に貼ってある注釈（`study.label_*`）。見取り図の札は部屋と同じ字にする。 */
const STUDY_LABEL_KEY: Partial<Record<HelpTopicId, string>> = {
  jar: 'label_jar',
  notebook: 'label_journal',
  board: 'label_board',
  archive: 'label_archive',
  write: 'label_pen',
};

export function HelpScreenCard({ screen, parts, texts, hovered }: HelpScreenCardProps) {
  const tStudy = useTranslations('study');
  const [pinned, setPinned] = useState<HelpTopicId | null>(null);
  const [local, setLocal] = useState<HelpTopicId | null>(null);
  const partIds = parts.map((p) => p.id);
  const fromScreen = hovered !== null && partIds.includes(hovered) ? hovered : null;
  // 面の中の触れ > 画面の中の触れ > 留めた札。
  const active = local ?? fromScreen ?? pinned;
  const source = local ? 'panel' : fromScreen ? 'screen' : pinned ? 'pinned' : 'none';
  const screenText = texts.get(screen.id);
  const activeText = active ? texts.get(active) : undefined;
  // 見取り図の札は、部屋に貼ってある注釈と同じ字（JAR / ENTRIES / …）。面の題が「手帳」で
  // 部屋が「ENTRIES」だと「手帳って何？」になる。話題の題のほうは「手帳（ENTRIES）」と両方を持つ。
  const titles = new Map<HelpTopicId, string>(
    [...texts.values()].map((text) => [text.id, text.title]),
  );
  for (const [part, key] of Object.entries(STUDY_LABEL_KEY)) {
    if (!isHelpTopicId(part) || key === undefined) continue;
    titles.set(part, tStudy(key));
  }
  const togglePin = (id: HelpTopicId) => setPinned((prev) => (prev === id ? null : id));

  return (
    <section
      {...verifyAttrs({
        unit: 'HelpScreenCard',
        screen: screen.id,
        parts: partIds.length === 0 ? 'none' : partIds.join(','),
        active: active ?? 'none',
        source,
      })}
      className="rounded-[14px] border px-4 pt-4 pb-4"
      style={{
        background: 'var(--surface-raised)',
        // 縁にアクセントを薄く溶かす。面の中で色を持つのは、この 1 枚とチュートリアルの番号だけ。
        borderColor: 'color-mix(in srgb, var(--accent) 28%, var(--surface-raised-border))',
        boxShadow: '0 1px 0 color-mix(in srgb, var(--accent) 10%, transparent)',
        ...CONTROL_FONT,
      }}
    >
      <div className="flex items-start gap-3">
        <span className="shrink-0 text-[var(--accent)]">
          <HelpIllustration kind={screen.illustration} size={44} />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="text-[15px] font-medium leading-snug text-[var(--fg)]">
            {screenText?.title}
          </h2>
          <p className="mt-0.5 text-[12px] leading-[1.6] text-[var(--date-color)]">
            {screenText?.lead}
          </p>
        </div>
      </div>

      {/* 書斎は手描きの見取り図。他の画面は部品の札を並べる。 */}
      {screen.id === 'study' && parts.length > 0 && (
        <div className="mt-3">
          <HelpStudyMap
            parts={partIds}
            titles={titles}
            active={active}
            pinned={pinned}
            onHover={setLocal}
            onPress={togglePin}
          />
        </div>
      )}
      {screen.id !== 'study' && parts.length > 0 && (
        <ul
          className="mt-3 grid gap-1.5"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))' }}
          onPointerLeave={() => setLocal(null)}
        >
          {parts.map((part) => {
            const lit = active === part.id;
            return (
              <li key={part.id}>
                <button
                  type="button"
                  data-part={part.id}
                  aria-pressed={pinned === part.id}
                  onPointerEnter={() => setLocal(part.id)}
                  onFocus={() => setLocal(part.id)}
                  onBlur={() => setLocal(null)}
                  onClick={() => togglePin(part.id)}
                  className="flex w-full flex-col items-center gap-1 rounded-[10px] border px-1.5 py-2 text-[10.5px] leading-tight transition-colors duration-150"
                  style={{
                    borderColor: lit
                      ? 'color-mix(in srgb, var(--accent) 55%, transparent)'
                      : 'var(--border-subtle)',
                    background: lit
                      ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
                      : 'transparent',
                    color: lit ? 'var(--fg)' : 'var(--date-color)',
                  }}
                >
                  <span className="text-[var(--accent)]">
                    <HelpIllustration kind={part.illustration} size={26} />
                  </span>
                  <span className="truncate">{texts.get(part.id)?.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* 読み上げには、いま灯っている札の題だけを伝える。 */}
      <span className="sr-only" aria-live="polite">
        {activeText?.title ?? ''}
      </span>
      {/* key で段落ごと作り直す。同じ箱の中で字だけ差し替わると、変わったことが見えない。 */}
      <div key={active ?? 'screen'} className="help-fade mt-3" data-explains={active ?? 'screen'}>
        {activeText ? (
          <>
            <p className="text-[12px] leading-[1.6] text-[var(--date-color)]">{activeText.lead}</p>
            <p className="mt-1.5 text-[13px] leading-[1.85] text-[var(--fg)] opacity-85">
              {activeText.body}
            </p>
          </>
        ) : (
          <p className="text-[13px] leading-[1.85] text-[var(--fg)] opacity-85">
            {screenText?.body}
          </p>
        )}
      </div>
    </section>
  );
}
