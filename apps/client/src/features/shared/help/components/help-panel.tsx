'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { CONTROL_FONT, ICON_STROKE_WIDTH } from '@/components/ui/surface';
import { HELP_PANEL_ATTR } from '../hover';
import { HELP_SECTIONS, HELP_TOPICS, helpTopic, screenParts } from '../topics';
import type {
  HelpMatch,
  HelpRemoteState,
  HelpTopicId,
  HelpTopicText,
  HelpTutorial as HelpTutorialState,
} from '../types';
import { HelpScreenCard } from './help-screen-card';
import { HelpTopicCard } from './help-topic-card';
import { HelpTutorial } from './help-tutorial';

/** 検索で出す件数の上限。 */
const MAX_RESULTS = 6;

export interface HelpPanelProps {
  texts: readonly HelpTopicText[];
  /** いま触れているもの。画面の 1 枚の中の札が灯る（画面の部品でなければ何も起きない）。 */
  hovered: HelpTopicId | null;
  /** いま開いている画面の話題。頭の 1 枚はこれ。 */
  screenTopic: HelpTopicId;
  /** 一覧の中で開いている話題。 */
  focused: HelpTopicId | null;
  onFocus: (topic: HelpTopicId | null) => void;
  query: string;
  onQueryChange: (query: string) => void;
  matches: readonly HelpMatch[];
  remote: HelpRemoteState;
  onClose: () => void;
  /** 「開く」。アプリの中は router、外は新しいタブ — 決めるのは呼び出し側。 */
  onOpenHref: (href: string, external: boolean) => void;
  /**
   * チュートリアルだけを明るくし、他を薄くする。初めての人に「ようこそ」を出している間だけ
   * true — 面以外が沈んでいる画面で、面の中でも見る場所を 1 つにする。晴れると元に戻る。
   */
  spotlight?: boolean;
  /** チュートリアルの進み具合といまの歩。 */
  tutorial?: HelpTutorialState;
}

const NO_TUTORIAL: HelpTutorialState = { step: null, done: null };

/**
 * ヘルプの面の中身（`docs/help-mode-guide.md`）。PC の右の面と SP のシートが共有する。
 *
 * 上から **検索欄 → 画面の 1 枚 → チュートリアル → 話題の一覧**。この並びは変わらない —
 * チュートリアルの最中でも、済んだ後でも（済むとアコーディオンが閉じて見出しだけ残る）。
 * 検索欄もいつも居る。
 *
 * - 面の名前（「使い方」）は書かない。右上の「?」を押して出た面が何かは、押した人が知っている
 * - 画面の 1 枚は、いま開いている画面の説明。画面の部品の札（書斎なら縮小図）が並び、
 *   画面の中で触れた物の札が灯って説明が開く。1 枚そのものは画面を移るまで変わらない
 * - 「はじめに」の話題は一覧に並べず、チュートリアルとして辿れる形で置く（`HelpTutorial`）
 * - 一覧に節の見出し（「書斎のもの」「画面」）は付けない。行の間の空きで束が分かり、
 *   行の線画で何の話かが分かる
 * - 検索欄に文字がある間は、一覧の代わりに近い話題だけを出す（上位 6 件、1 件目は開いた状態）
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
  onClose,
  onOpenHref,
  spotlight = false,
  tutorial = NO_TUTORIAL,
}: HelpPanelProps) {
  const t = useTranslations('help');
  // 検索の 1 件目は開いておくが、押せば閉じられる。文が変われば開き直す。
  const [autoCollapsed, setAutoCollapsed] = useState(false);
  const changeQuery = (next: string) => {
    onQueryChange(next);
    setAutoCollapsed(false);
    // 一覧で開いていた行は検索結果に持ち越さない（3 位に来た行だけ開く、が起きる）。
    if (focused !== null) onFocus(null);
  };
  const searchId = useId();
  const searching = query.trim().length > 0;
  // 近い順の上位だけ。手元の照合は 2 文字の並びで重ねるので、長い文だと話題の大半に
  // 薄く当たる。11 件並ぶと「近い話題」ではなく一覧の並べ替えに見えてしまう。
  const shown = matches.slice(0, MAX_RESULTS);
  const textOf = new Map<HelpTopicId, HelpTopicText>(texts.map((text) => [text.id, text]));
  const screen = helpTopic(screenTopic);
  const parts = screenParts(screenTopic).map(helpTopic);
  const dimClass = `transition-opacity duration-500 ${spotlight ? 'opacity-30' : 'opacity-100'}`;

  return (
    <div
      {...{ [HELP_PANEL_ATTR]: '' }}
      {...verifyAttrs({
        unit: 'HelpPanel',
        mode: searching ? 'search' : 'browse',
        screen: screenTopic,
        hovered: hovered ?? 'none',
        focused: focused ?? 'none',
        resultCount: searching ? shown.length : -1,
        remote,
        spotlight,
        step: tutorial.step ?? 'none',
      })}
      className="flex h-full min-h-0 flex-col"
      style={CONTROL_FONT}
    >
      {/* 検索欄と、閉じる。1 行に収める。 */}
      <div className="flex shrink-0 items-center gap-2 px-4">
        <label
          htmlFor={searchId}
          className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-[10px] border px-3"
          style={{ background: 'var(--bg)', borderColor: 'var(--surface-sunken-border)' }}
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
            onChange={(event) => changeQuery(event.target.value)}
            maxLength={200}
            // 書いている最中の `Esc` は文を消すだけ。面を閉じるのは、空の欄でもう一度。
            // （preventDefault で、面を閉じる側の keydown に「済み」と伝える）
            onKeyDown={(event) => {
              if (event.key !== 'Escape' || event.nativeEvent.isComposing || !searching) return;
              event.preventDefault();
              changeQuery('');
            }}
            placeholder={t('search_placeholder')}
            autoComplete="off"
            // ブラウザ既定の消す印（WebKit の青い ×）は出さない。消す道は右の自前のボタン 1 つ。
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--fg)] outline-none placeholder:text-[var(--date-color)] [&::-webkit-search-cancel-button]:appearance-none"
          />
          {searching && (
            <button
              type="button"
              onClick={() => changeQuery('')}
              aria-label={t('search_clear')}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--date-color)] hover:text-[var(--fg)]"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </label>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[var(--date-color)] transition-colors duration-150 hover:bg-[var(--hover-wash)] hover:text-[var(--fg)]"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-4 pb-5">
        {searching ? (
          <div className="flex flex-col gap-0.5">
            {shown.length === 0 ? (
              <p className="px-2 py-3 text-[12px] leading-[1.7] text-[var(--date-color)]">
                {remote === 'asking' ? t('search_asking') : t('search_empty')}
              </p>
            ) : (
              shown.map((match, index) => {
                const text = textOf.get(match.id);
                if (!text) return null;
                // 検索の 1 件目は開いておく。押して読むまでの手数を減らす。
                const expanded =
                  focused === match.id || (focused === null && index === 0 && !autoCollapsed);
                return (
                  <HelpTopicCard
                    key={match.id}
                    topic={helpTopic(match.id)}
                    text={text}
                    expanded={expanded}
                    onToggle={() => {
                      if (expanded) {
                        onFocus(null);
                        if (index === 0) setAutoCollapsed(true);
                        return;
                      }
                      onFocus(match.id);
                      setAutoCollapsed(false);
                    }}
                    openLabel={t('open_topic')}
                    onOpen={onOpenHref}
                    badge={match.source === 'jev' ? t('pick_badge') : undefined}
                  />
                );
              })
            )}
            {remote === 'asking' && shown.length > 0 && (
              <p className="px-2 pt-1 text-[10.5px] text-[var(--date-color)]">
                {t('search_asking')}
              </p>
            )}
          </div>
        ) : (
          <>
            {/* 「ようこそ」の間だけ、チュートリアル以外が薄い（晴れると 500ms で戻る）。 */}
            <div className={dimClass}>
              {/* key で画面ごとに作り直す。留めた札（と面の中の触れ）は 1 枚の中の状態なので、
                  同じ部品のまま画面を移ると前の画面の札が残り、ボードの 1 枚に書庫の説明が
                  居座っていた（実機レビュー）。 */}
              <HelpScreenCard
                key={screen.id}
                screen={screen}
                parts={parts}
                texts={textOf}
                hovered={hovered}
              />
            </div>
            {/* チュートリアルの箱。灯ったとき地に余白があるよう、左右は面の余白へ 8px はみ出す。
                行の左端は一覧と揃う。 */}
            <div
              className={`-mx-2 mt-3 rounded-[12px] px-2 pt-1 pb-1 transition-colors duration-500 ${spotlight ? 'help-spot' : ''}`}
            >
              <HelpTutorial
                onOpenHref={onOpenHref}
                progress={tutorial.done}
                current={tutorial.step}
              />
            </div>
            {/* 一覧。節の見出しは無く、束の間は細い線 1 本。行の余白はどの行も同じ
                （束の頭の行だけ上が広い、といった不揃いを作らない）。「はじめに」はチュートリアルが担う。 */}
            <div className={`mt-3 flex flex-col ${dimClass}`}>
              {HELP_SECTIONS.filter((section) => section !== 'start').map((section) => (
                <div
                  key={section}
                  className="flex flex-col border-t py-2 first:border-t-0 first:pt-0 last:pb-0"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
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
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CloseIcon({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={ICON_STROKE_WIDTH}
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
