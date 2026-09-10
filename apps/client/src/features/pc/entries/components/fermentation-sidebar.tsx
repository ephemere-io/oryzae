'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useLocale, useTranslations } from 'next-intl';
import { type DragEvent as ReactDragEvent, useState } from 'react';
import { NavRow } from '@/components/ui/nav-row';
import { Select } from '@/components/ui/select';
import { ICON_STROKE_WIDTH, SHELL_INSET, SIDE_PANEL_WIDTH } from '@/components/ui/surface';
import type { FermentationDetail } from '@/features/shared/fermentation/types';

/** 面の中で選べる問い。テキストは表示用に解決済み。 */
export interface SidebarQuestion {
  id: string;
  text: string;
}

interface FermentationSidebarProps {
  /** まだ発酵が無いこともある（問いは紐づいているが結果はこれから）。 */
  detail: FermentationDetail | null;
  /** 結ばれている問い。2つ以上あるときだけ切り替えが出る。 */
  questions: SidebarQuestion[];
  selectedQuestionId: string | null;
  onSelectQuestion: (questionId: string) => void;
  /** 選び直した直後は取りに行っている最中。空と区別する。 */
  loading?: boolean;
  /** 畳んでいるか。畳んでいるときは縁だけを残す（左のサイドバーと同じ作法）。 */
  collapsed: boolean;
  onToggle: () => void;
}

const MAX_KEYWORDS = 5;
const MAX_SNIPPETS = 3;
const SNIPPET_PREVIEW_LENGTH = 60;

/** 面が見せられるもの。**発酵1件がこの3つを持つ**ので、切り替えの軸もこの3つ。 */
type View = 'letter' | 'keywords' | 'snippets';

const VIEWS: View[] = ['letter', 'keywords', 'snippets'];

/** 面の中で開いている1件。 */
type OpenItem =
  | { kind: 'keyword'; keyword: string; description: string }
  | { kind: 'snippet'; originalText: string; sourceDate: string; selectionReason: string };

/**
 * 掴んだ言葉を本文へ渡す。ここで決めるのは**何を渡すか**だけ。
 * 受け取り（onDragOver / onDrop）と state の同期はエディタ側が持つ。
 */
function startTextDrag(e: ReactDragEvent, text: string) {
  e.dataTransfer.setData('text/plain', text);
  e.dataTransfer.effectAllowed = 'copy';
}

/**
 * 発酵が見ていた期間（`2026-05` のような年月）を、読める形にする。
 *
 * 手紙もことばも、**いつのものか**が分からないと過去の重みが伝わらない。個々の要素は
 * 日付を持たないので（型に無い）、発酵1件が見ていた期間を面の頭に出す。
 * 断片だけは自分の出どころの日付を持つので、そちらは各行に添える。
 */
function formatPeriod(period: string, locale: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = new Date(Date.UTC(year, month - 1, 1));
  if (Number.isNaN(date.getTime())) return period;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(date);
}

/** 過去の言葉（キーワード）の地。 */
const PAST_WORD_STYLE = {
  borderColor: 'color-mix(in srgb, var(--accent) 35%, transparent)',
  background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
} as const;

const VIEW_ICON_PATHS: Record<View, string> = {
  letter:
    'M3 7.5 12 13l9-5.5M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z',
  keywords: 'M20.6 13.4 12 4.8H4.8V12l8.6 8.6a2 2 0 0 0 2.8 0l4.4-4.4a2 2 0 0 0 0-2.8ZM8.5 8.5h.01',
  snippets: 'M9 7H5.5A1.5 1.5 0 0 0 4 8.5V12h4l-1 5M19 7h-3.5A1.5 1.5 0 0 0 14 8.5V12h4l-1 5',
};

function ViewIcon({ view }: { view: View }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={ICON_STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d={VIEW_ICON_PATHS[view]} />
    </svg>
  );
}

/**
 * エントリー画面の発酵結果サイドバー（Issue #466）。
 *
 * エントリーは「テキストのロジックに他のオブジェクトが従う世界」（docs/entry-screen-design.md §1）
 * なので、本文の流れを乱すものは本文に置かない。手紙・キーワード・スニペットはここに集約し、
 * 本文は先頭から末尾まで途切れないようにする。
 *
 * ## 面は2つの軸で決まる
 *
 * **どの問いの**（＝どの発酵の）**何を**見るか。問いは複数結べるので、片方だけでは足りない。
 *
 * - 問い … 2つ以上結ばれているときだけ、面の頭に切り替えが出る。1つなら選ぶものが
 *   無いので出さない（選択肢が1つの選択肢は、選択ではなく飾りになる）
 * - 何を … 手紙・ことば・断片。**左のサイドバーと同じ行**（components/ui/nav-row）で並べる。
 *   同じ「選んで移る」ことが、画面ごとに別の見た目で語られないようにする
 *
 * 以前は3つを縦に積み、面の見出しが「最初に中身があるもの」の名前になっていた。
 * 見出しが中身次第で変わるので、いま何を見ているのかを名前から知ることができなかった。
 *
 * ## ことばと断片は、掴めば入り、押せば読める
 *
 * **どちらも同じ形にする。** 片方が矢印で片方がボタン、片方はつまみだけ掴める、という
 * 状態だと、同じ「過去の言葉」なのに触り方を2つ覚えることになる。
 * 項目そのものを掴めて、項目そのものを押せる（掴んだときはクリックが起きない、という
 * ブラウザの決まりに乗る）。
 *
 * 掴んで本文へ落とせばその位置に入る。ここで決めるのは**何を渡すか**だけで、
 * 受け取りと state の同期はエディタ側の onDrop が持つ
 * （ブラウザ任せにすると DOM だけ変わって保存が気づかない）。
 *
 * ## 色は本文と同じ世界のもの
 *
 * 地は左のサイドバーと同じ `--surface-sunken`、効かせる色は `--accent`（アプリで唯一の緑）
 * だけにする。過去の言葉は本文と同じ明朝で置く。
 *
 * ## 開閉
 *
 * 左のサイドバーと同じで、**畳んでいるときも縁が残る**。パレットからも開閉できるが、
 * 面そのものにも開く道が要る——閉じたあと、開き直す場所が画面の反対側にしか無いのは
 * 遠い。開くか畳むかの2状態だけで、中間は持たない。
 */
export function FermentationSidebar({
  detail,
  questions,
  selectedQuestionId,
  onSelectQuestion,
  loading = false,
  collapsed,
  onToggle,
}: FermentationSidebarProps) {
  const t = useTranslations('editor.fermentation_sidebar');
  const locale = useLocale();
  const td = useTranslations('editor.fermentation_overlay.detail');
  const [open, setOpen] = useState<OpenItem | null>(null);
  // 「まだ何も選んでいない」を持たない。**面は必ず何かを見ている**——空の面を出して
  // 選ばせるより、いちばん読みたいもの（手紙）を先に出すほうが手数が少ない。
  const [requestedView, setRequestedView] = useState<View | null>(null);

  const keywords = detail?.keywords.slice(0, MAX_KEYWORDS) ?? [];
  const snippets = detail?.snippets.slice(0, MAX_SNIPPETS) ?? [];
  const letter = detail?.letter ?? null;
  const isEmpty = keywords.length === 0 && snippets.length === 0 && letter === null;

  const has: Record<View, boolean> = {
    letter: letter !== null,
    keywords: keywords.length > 0,
    snippets: snippets.length > 0,
  };
  // 選ばれていた面が、問いを替えた先に無いこともある。そのときは中身のある先頭へ落とす
  // （空の面をそのまま見せ続けると、切り替えが効いていないように見える）。
  const fallbackView: View = VIEWS.find((v) => has[v]) ?? 'letter';
  const view: View = requestedView && has[requestedView] ? requestedView : fallbackView;

  const headers = {
    keyword: td('header_keyword'),
    snippet: td('header_snippet'),
  };
  const viewLabel: Record<View, string> = {
    letter: t('section_letter'),
    keywords: t('section_keywords'),
    snippets: t('section_snippets'),
  };

  // 畳んだ姿でも**同じ契約を出す**。片方だけ欠けると、契約を読む側が
  // 「0件」なのか「畳んでいるだけ」なのかを区別できない。
  const contract = verifyAttrs({
    unit: 'FermentationSidebar',
    keywordCount: keywords.length,
    snippetCount: snippets.length,
    hasLetter: letter !== null,
    empty: isEmpty,
    detailOpen: !collapsed && open !== null,
    detailType: collapsed ? 'none' : (open?.kind ?? 'none'),
    view: collapsed ? 'none' : view,
    questionCount: questions.length,
    collapsed,
  });

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-label={t('open_aria')}
        title={t('open_aria')}
        aria-expanded={false}
        // 左のサイドバーと同じポインタ。畳んでいれば左へ開くので w-resize。
        className="flex h-full w-3 shrink-0 cursor-w-resize border-l transition-colors duration-150 hover:bg-[var(--hover-wash)]"
        style={{
          borderColor: 'var(--surface-sunken-border)',
          background: 'var(--surface-sunken)',
        }}
        {...contract}
      />
    );
  }

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col overflow-hidden border-l"
      style={{
        width: SIDE_PANEL_WIDTH,
        paddingTop: SHELL_INSET,
        paddingBottom: SHELL_INSET,
        borderColor: 'var(--surface-sunken-border)',
        background: 'var(--surface-sunken)',
      }}
      {...contract}
    >
      {/* 面の始まりを示す1行。中身を開いているときは、そのまま戻る導線を兼ねる。 */}
      <div className="mb-3 flex h-6 shrink-0 items-center gap-1 px-5">
        {open && (
          <button
            type="button"
            onClick={() => setOpen(null)}
            aria-label={t('back_aria')}
            className="-ml-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--date-color)] transition-colors duration-150 hover:bg-[var(--hover-wash)] hover:text-[var(--fg)]"
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={ICON_STROKE_WIDTH}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
            </svg>
          </button>
        )}
        <span className="flex-1 truncate text-[11px] font-medium tracking-[0.12em] text-[var(--fg)] opacity-45">
          {open ? headers[open.kind] : viewLabel[view]}
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-label={t('close_aria')}
          className="-mr-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--date-color)] transition-colors duration-150 hover:bg-[var(--hover-wash)] hover:text-[var(--fg)]"
        >
          <svg
            aria-hidden="true"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={ICON_STROKE_WIDTH}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      {/* どの問いの発酵を見るか。**2つ以上結ばれているときだけ**出す。
          1つしか無いのに選ばせると、選択肢が1つの選択になる。 */}
      {questions.length > 1 && (
        <div className="mb-3 px-5">
          <Select
            value={selectedQuestionId ?? ''}
            options={questions.map((q) => ({ value: q.id, label: q.text }))}
            onChange={onSelectQuestion}
            ariaLabel={t('question_select_aria')}
            placeholder={t('question_select_placeholder')}
          />
        </div>
      )}

      {/* 何を見るか。**左のサイドバーと同じ行**で並べる。 */}
      <nav className="mb-3 flex shrink-0 flex-col gap-1 px-4">
        {VIEWS.map((v) => (
          <NavRow
            key={v}
            label={viewLabel[v]}
            icon={<ViewIcon view={v} />}
            active={!open && view === v}
            onClick={() => {
              setOpen(null);
              setRequestedView(v);
            }}
          />
        ))}
      </nav>

      {/* いつのものか。個々の要素は日付を持たないので、発酵が見ていた期間をここで言う。 */}
      {detail && !open && (
        <p className="mb-3 px-5 text-[11px] text-[var(--date-color)]">
          {formatPeriod(detail.targetPeriod, locale)}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {open ? (
          <ItemDetail item={open} sourcePrefix={td('snippet_source_prefix')} />
        ) : loading ? (
          <p className="px-5 text-[13px] leading-relaxed text-[var(--date-color)]">
            {t('loading')}
          </p>
        ) : !has[view] ? (
          // 空でも面ごと消さない。**その入れ物があること自体**は伝わっているべき。
          <p className="px-5 text-[13px] leading-relaxed text-[var(--date-color)]">{t('empty')}</p>
        ) : view === 'letter' && letter ? (
          <div
            className="px-5 text-[13px] leading-[2] whitespace-pre-wrap text-[var(--fg)]"
            style={{ fontFamily: "'Noto Serif JP', serif" }}
          >
            {letter.bodyText}
          </div>
        ) : view === 'keywords' ? (
          <div className="flex flex-wrap gap-1.5 px-5">
            {keywords.map((kw) => (
              <button
                key={kw.id}
                type="button"
                draggable
                onDragStart={(e) => startTextDrag(e, kw.keyword)}
                onClick={() =>
                  setOpen({
                    kind: 'keyword',
                    keyword: kw.keyword,
                    description: kw.description,
                  })
                }
                title={t('drag_or_open')}
                className="flex h-7 cursor-grab items-center gap-1.5 rounded-full border px-3 text-[12px] transition-colors duration-150 hover:brightness-[0.96] active:cursor-grabbing"
                style={{
                  ...PAST_WORD_STYLE,
                  color: 'var(--accent)',
                  fontFamily: "'Noto Serif JP', serif",
                  letterSpacing: '0.06em',
                }}
              >
                {kw.keyword}
                <span aria-hidden="true" className="text-[10px] opacity-60">
                  ›
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2 px-5">
            {snippets.map((s) => (
              <button
                key={s.id}
                type="button"
                draggable
                onDragStart={(e) => startTextDrag(e, s.originalText)}
                onClick={() =>
                  setOpen({
                    kind: 'snippet',
                    originalText: s.originalText,
                    sourceDate: s.sourceDate,
                    selectionReason: s.selectionReason,
                  })
                }
                title={t('drag_or_open')}
                className="flex w-full cursor-grab items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-[var(--hover-wash)] active:cursor-grabbing"
                style={{ fontFamily: "'Noto Serif JP', serif" }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] leading-relaxed text-[var(--fg)]">
                    {s.originalText.length > SNIPPET_PREVIEW_LENGTH
                      ? `${s.originalText.substring(0, SNIPPET_PREVIEW_LENGTH)}…`
                      : s.originalText}
                  </span>
                  {/* 断片は出どころの日付を持つ。いつ書いた自分の言葉なのかが要る。 */}
                  {s.sourceDate && (
                    <span className="mt-1 block text-[10px] text-[var(--date-color)]">
                      {s.sourceDate}
                    </span>
                  )}
                </span>
                <span
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-[10px] text-[var(--accent)] opacity-60"
                >
                  ›
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

/** 開いた1件の中身。面は入れ替わるだけで、幅も地も変わらない。 */
function ItemDetail({ item, sourcePrefix }: { item: OpenItem; sourcePrefix: string }) {
  return (
    <div
      className="px-5 text-[13px] leading-[2] text-[var(--fg)]"
      style={{ fontFamily: "'Noto Serif JP', serif" }}
    >
      {item.kind === 'keyword' && (
        <>
          <h3 className="mb-3 text-[16px] font-medium text-[var(--accent)]">{item.keyword}</h3>
          <p>{item.description}</p>
        </>
      )}

      {item.kind === 'snippet' && (
        <>
          <blockquote
            className="mb-4 border-l-2 pl-3 text-[14px] leading-relaxed"
            style={{ borderColor: 'color-mix(in srgb, var(--accent) 45%, transparent)' }}
          >
            {item.originalText}
          </blockquote>
          {item.sourceDate && (
            <p className="mb-4 text-[11px] text-[var(--date-color)]">
              {sourcePrefix} {item.sourceDate}
            </p>
          )}
          <p>{item.selectionReason}</p>
        </>
      )}
    </div>
  );
}
