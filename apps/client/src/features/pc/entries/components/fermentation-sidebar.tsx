'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { type DragEvent as ReactDragEvent, useState } from 'react';
import { ICON_STROKE_WIDTH, SHELL_INSET, SIDE_PANEL_WIDTH } from '@/components/ui/surface';
import type { FermentationDetail } from '@/features/shared/fermentation/types';

interface FermentationSidebarProps {
  detail: FermentationDetail;
  onClose: () => void;
}

const MAX_KEYWORDS = 5;
const MAX_SNIPPETS = 3;
const SNIPPET_PREVIEW_LENGTH = 60;

/**
 * 掴んだ言葉を本文へ渡す。ここで決めるのは**何を渡すか**だけ。
 * 受け取り（onDragOver / onDrop）と state の同期はエディタ側が持つ。
 */
function startTextDrag(e: ReactDragEvent, text: string) {
  e.dataTransfer.setData('text/plain', text);
  e.dataTransfer.effectAllowed = 'copy';
}

type OpenItem =
  | { kind: 'keyword'; keyword: string; description: string }
  | { kind: 'snippet'; originalText: string; sourceDate: string; selectionReason: string };

/**
 * エントリー画面の発酵結果サイドバー（Issue #466）。
 *
 * エントリーは「テキストのロジックに他のオブジェクトが従う世界」（docs/entry-screen-design.md §1）
 * なので、本文の流れを乱すものは本文に置かない。手紙・キーワード・スニペットはここに集約し、
 * 本文は先頭から末尾まで途切れないようにする。
 *
 * ## 面は1枚
 *
 * 以前は、この面から項目を押すとさらに別の面が右から重なって出てきた（面が2枚）。
 * 同じ場所に同じ幅の面が2枚重なると、どちらを見ているのか分からなくなるし、閉じる操作も
 * 2回要る。**1枚の中で入れ替える**: 一覧 ⇄ 中身。左上の矢印で一覧へ返る。
 *
 * 手紙だけは畳まない。この面に来る目的そのものなので、**開いた瞬間から読める**ように
 * そのまま置く（押して開く形だと、読むのに1手余分に要る）。面の見出しは「手紙」。
 *
 * ## ことばと断片は本文へ引ける
 *
 * 過去の言葉をいまの文章に取り込むのがこの面の役目なので、掴んで本文へ落とせば
 * その位置に入る。ここで決めるのは**何を渡すか**だけで、受け取りと state の同期は
 * エディタ側の onDrop が持つ（ブラウザ任せにすると DOM だけ変わって保存が気づかない）。
 *
 * ## 色は本文と同じ世界のもの
 *
 * 砂色のグラデーションや別系統の茶の枠を持っていて、エントリー画面の中で明らかに出自の
 * 違う部品に見えていた。地は左のサイドバーと同じ `--surface-sunken`、効かせる色は
 * `--accent`（アプリで唯一の緑）だけにする。過去の言葉は本文と同じ明朝で置く。
 *
 * ## 高さ
 *
 * `h-full` を明示する。親の flex 行に置いただけでは中身ぶんの高さしか持たず、
 * 面が画面の上半分で切れて見えていた。
 */
export function FermentationSidebar({ detail, onClose }: FermentationSidebarProps) {
  const t = useTranslations('editor.fermentation_sidebar');
  const td = useTranslations('editor.fermentation_overlay.detail');
  const [open, setOpen] = useState<OpenItem | null>(null);

  const keywords = detail.keywords.slice(0, MAX_KEYWORDS);
  const snippets = detail.snippets.slice(0, MAX_SNIPPETS);
  const isEmpty = keywords.length === 0 && snippets.length === 0 && detail.letter === null;

  const headers = {
    keyword: td('header_keyword'),
    snippet: td('header_snippet'),
  };

  // 面の見出し。「発酵」とだけ書かれていても何のことか分からないので、
  // いま何を見ているか（手紙／ことば／断片）を出す。
  const heading = open ? headers[open.kind] : detail.letter ? t('section_letter') : t('heading');

  return (
    <aside
      className="flex h-full shrink-0 flex-col overflow-hidden border-l"
      style={{
        width: SIDE_PANEL_WIDTH,
        paddingTop: SHELL_INSET,
        paddingBottom: SHELL_INSET,
        borderColor: 'var(--surface-sunken-border)',
        background: 'var(--surface-sunken)',
      }}
      {...verifyAttrs({
        unit: 'FermentationSidebar',
        keywordCount: keywords.length,
        snippetCount: snippets.length,
        hasLetter: detail.letter !== null,
        empty: isEmpty,
        detailOpen: open !== null,
        detailType: open?.kind ?? 'none',
      })}
    >
      {/* 面の始まりを示す1行。中身を開いているときは、そのまま戻る導線を兼ねる。 */}
      <div className="mb-5 flex h-6 shrink-0 items-center gap-1 px-5">
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
          {heading}
        </span>
        <button
          type="button"
          onClick={onClose}
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

      <div className="min-h-0 flex-1 overflow-y-auto">
        {open ? (
          <ItemDetail item={open} sourcePrefix={td('snippet_source_prefix')} />
        ) : (
          <>
            {isEmpty && (
              <p className="px-5 text-[13px] leading-relaxed text-[var(--date-color)]">
                {t('empty')}
              </p>
            )}

            {/* 手紙はこの面に来る目的そのもの。畳まずそのまま置く（見出しは面の上にある）。 */}
            {detail.letter && (
              <div
                className="mb-7 px-5 text-[13px] leading-[2] whitespace-pre-wrap text-[var(--fg)]"
                style={{ fontFamily: "'Noto Serif JP', serif" }}
              >
                {detail.letter.bodyText}
              </div>
            )}

            {keywords.length > 0 && (
              <Section label={t('section_keywords')}>
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map((kw) => (
                    <button
                      key={kw.id}
                      type="button"
                      // 掴んで本文へ落とせば、その位置に入る。押せば意味を読む。
                      draggable
                      onDragStart={(e) => startTextDrag(e, kw.keyword)}
                      onClick={() =>
                        setOpen({
                          kind: 'keyword',
                          keyword: kw.keyword,
                          description: kw.description,
                        })
                      }
                      className="flex h-7 cursor-grab items-center rounded-full border px-3 text-[12px] transition-colors duration-150 active:cursor-grabbing"
                      style={{
                        borderColor: 'color-mix(in srgb, var(--accent) 35%, transparent)',
                        background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                        color: 'var(--accent)',
                        fontFamily: "'Noto Serif JP', serif",
                        letterSpacing: '0.06em',
                      }}
                    >
                      {kw.keyword}
                    </button>
                  ))}
                </div>
              </Section>
            )}

            {snippets.length > 0 && (
              <Section label={t('section_snippets')}>
                <div className="flex flex-col gap-2">
                  {snippets.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      // 掴めば本文へ引き込める。落とすのは**全文**（一覧の表示は頭打ちだが、
                      // 取り込むときに切れていては使い物にならない）。
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
                      // 断片は自分が過去に書いた文なので、本文と同じ明朝で、引用のように
                      // 左の罫だけを持たせる（面の中で唯一の線）。
                      className="cursor-grab border-l-2 py-1 pl-3 text-left text-[12px] leading-relaxed text-[var(--fg)] transition-colors duration-150 hover:border-[var(--accent)] active:cursor-grabbing"
                      style={{
                        borderColor: 'var(--surface-sunken-border)',
                        fontFamily: "'Noto Serif JP', serif",
                      }}
                    >
                      {s.originalText.length > SNIPPET_PREVIEW_LENGTH
                        ? `${s.originalText.substring(0, SNIPPET_PREVIEW_LENGTH)}…`
                        : s.originalText}
                    </button>
                  ))}
                </div>
              </Section>
            )}
          </>
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

/**
 * まとまり。設定パネルの Section と同じ作法（小さく薄い見出し1行 + 余白で区切る）。
 * 左右の余白は面全体で 20px に揃える。
 */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col px-5 pb-7 last:pb-0">
      <div className="mb-2 flex h-5 items-center">
        <span className="text-[11px] tracking-[0.04em] text-[var(--fg)] opacity-40">{label}</span>
      </div>
      {children}
    </section>
  );
}
