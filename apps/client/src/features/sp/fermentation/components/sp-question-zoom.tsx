'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { CONTROL_FONT } from '@/components/ui/surface';
import type { FermentationDetail } from '@/features/shared/fermentation/types';
import type { SpJarElement } from '@/features/sp/fermentation/components/sp-element-sheet';
import { formatMonthDay } from '@/lib/format-date';

interface SpQuestionZoomProps {
  questionText: string;
  detail: FermentationDetail | null;
  loading: boolean;
  onClose: () => void;
  onOpenElement: (element: SpJarElement) => void;
}

/** 見出しの円の直径。画面幅の 6 割、ただし大きな端末で膨らみすぎない。 */
const HEADING_SIZE = 'min(60vw, 236px)';

/** 問いの字の大きさ。長い問い（上限 64 字）は 1 段小さくして円に収める。 */
const LONG_QUESTION_CHARS = 36;

/** その人の言葉（問い・言葉・抜粋）の書体。道具の字（`CONTROL_FONT`）と混ぜない。 */
const SERIF_FONT = "'Noto Serif JP', serif";

/**
 * 問いの円をひとつ開いた画面。**円は「器」ではなく「見出し」。**
 *
 * 以前は開いた円の中に言葉・抜粋・手紙を輪の上に並べ、本文はシートで読ませていた。
 * 312px の円に 104px の抜粋カードを 4 枚・言葉を 6 つ置くと、12 時と 6 時で重なり、
 * 3 時と 9 時では円の外へはみ出し、抜粋は 14 字で切れて「見切れて読めない」と
 * 報告された。長い問いは輪が 3 重になって 6 時側は逆さ文字、最外輪は画面幅で切れた。
 *
 * いまは上に小さな円（問いはその中に折り返して書く）、下に手紙・言葉・抜粋の
 * **普通の縦リスト**。抜粋は 3 行まで読め、数が増えても縦に伸びるだけで重ならない。
 * 行を押すと `SpElementSheet` で全文を読む（手紙は全画面の読み面）。輪に並べる配置は、
 * 軌道の円の「中身の予告」（`SpJarOrbit`）にだけ残す。
 *
 * 円の中で要素を動かして位置を憶える仕組みは SP から外した。リストに置き場は無く、
 * 動かす意味が消えたため（PC の瓶は引き続き `PUT /api/v1/jar/layout` に憶える）。
 */
export function SpQuestionZoom({
  questionText,
  detail,
  loading,
  onClose,
  onOpenElement,
}: SpQuestionZoomProps) {
  const t = useTranslations('sp.jar');

  const keywords = detail?.keywords ?? [];
  const snippets = detail?.snippets ?? [];
  const letter = detail?.letter ?? null;
  const empty = !loading && keywords.length === 0 && snippets.length === 0 && letter === null;

  return (
    <div
      className="sp-rise absolute inset-0 z-20 flex flex-col"
      style={{ background: 'var(--bg)' }}
      {...verifyAttrs({
        unit: 'SpQuestionZoom',
        loading,
        keywordCount: keywords.length,
        snippetCount: snippets.length,
        hasLetter: letter !== null,
        empty,
      })}
    >
      <header className="flex items-center justify-end px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          className="min-h-[40px] shrink-0 rounded-full border px-4 text-[13px]"
          style={{ ...CONTROL_FONT, color: 'var(--fg)', borderColor: 'var(--border-subtle)' }}
        >
          {t('close')}
        </button>
      </header>

      {/* 見出しの円。問いは輪ではなく中に書く（輪は 6 時側が逆さになり、長いと画面幅で切れる）。 */}
      <div className="flex shrink-0 justify-center px-6">
        <div
          className="flex items-center justify-center rounded-full"
          style={{
            width: HEADING_SIZE,
            height: HEADING_SIZE,
            background:
              'radial-gradient(circle at 50% 42%, rgba(253,251,247,0.85), rgba(253,251,247,0.2))',
            border: '1px solid rgba(226,194,142,0.5)',
            boxShadow: '0 8px 40px rgba(140,133,126,0.12)',
          }}
        >
          <h2
            data-question-heading
            className="m-0 px-7 text-center font-medium leading-relaxed"
            style={{
              fontFamily: SERIF_FONT,
              fontSize: questionText.length > LONG_QUESTION_CHARS ? 14 : 16,
              color: '#7A3B3F',
              letterSpacing: '0.04em',
              textWrap: 'balance',
            }}
          >
            {questionText}
          </h2>
        </div>
      </div>

      {/* 中身。読める大きさで縦に並べる。行を押すと全文（手紙は全画面）。 */}
      <div className="min-h-0 flex-1 overflow-auto px-5 pt-6 pb-8">
        {loading ? (
          <p className="py-8 text-center text-xs" style={{ color: 'var(--date-color)' }}>
            …
          </p>
        ) : null}

        {empty ? (
          <p
            className="px-6 py-8 text-center text-sm leading-relaxed"
            style={{ color: 'var(--date-color)' }}
          >
            {t('not_fermented')}
          </p>
        ) : null}

        {letter ? (
          <Section label={t('section_letter')}>
            <Row
              testId="sp-jar-letter"
              ariaLabel={t('section_letter')}
              onClick={() =>
                onOpenElement({
                  kind: 'letter',
                  id: letter.id,
                  bodyText: letter.bodyText,
                  sources: detail?.scannedEntries ?? [],
                })
              }
            >
              <span
                className="flex shrink-0 items-center justify-center rounded-full"
                style={{
                  width: 40,
                  height: 40,
                  background: 'linear-gradient(135deg, #FFFFFF, #FBF1EE)',
                  border: '1.5px solid rgba(122,59,63,0.45)',
                }}
              >
                <LetterIcon />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className="block text-[15px] leading-snug"
                  style={{ fontFamily: SERIF_FONT, color: 'var(--fg)' }}
                >
                  {t('section_letter')}
                </span>
                {detail?.targetPeriod ? (
                  <span
                    className="mt-0.5 block text-[11px] tracking-[0.08em]"
                    style={{ ...CONTROL_FONT, color: 'var(--date-color)' }}
                  >
                    {detail.targetPeriod.replace('-', '.')}
                  </span>
                ) : null}
              </span>
            </Row>
          </Section>
        ) : null}

        {keywords.length > 0 ? (
          <Section label={t('section_keywords')}>
            {keywords.map((keyword) => (
              <Row
                key={keyword.id}
                onClick={() =>
                  onOpenElement({
                    kind: 'keyword',
                    id: keyword.id,
                    keyword: keyword.keyword,
                    description: keyword.description,
                  })
                }
              >
                <span
                  className="min-w-0 flex-1 text-[15px] leading-snug"
                  style={{ fontFamily: SERIF_FONT, color: 'var(--fg)' }}
                >
                  {keyword.keyword}
                </span>
              </Row>
            ))}
          </Section>
        ) : null}

        {snippets.length > 0 ? (
          <Section label={t('section_snippets')}>
            {snippets.map((snippet) => (
              <Row
                key={snippet.id}
                onClick={() =>
                  onOpenElement({
                    kind: 'snippet',
                    id: snippet.id,
                    originalText: snippet.originalText,
                    sourceDate: snippet.sourceDate,
                    selectionReason: snippet.selectionReason,
                  })
                }
              >
                <span className="min-w-0 flex-1">
                  <span
                    className="block text-[14px] leading-relaxed"
                    style={{
                      fontFamily: SERIF_FONT,
                      color: 'var(--fg)',
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 3,
                      overflow: 'hidden',
                    }}
                  >
                    「{snippet.originalText}」
                  </span>
                  <span
                    className="mt-1 block text-[11px] tracking-[0.06em]"
                    style={{ ...CONTROL_FONT, color: 'var(--date-color)' }}
                  >
                    {formatMonthDay(snippet.sourceDate)}
                  </span>
                </span>
              </Row>
            ))}
          </Section>
        ) : null}
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <p
        className="mb-1 text-[11px] uppercase tracking-[0.14em]"
        style={{ ...CONTROL_FONT, color: 'var(--accent)' }}
      >
        {label}
      </p>
      <ul className="m-0 list-none p-0">{children}</ul>
    </section>
  );
}

interface RowProps {
  onClick: () => void;
  /** 文字を持たない行（手紙）を掴むための目印。 */
  testId?: string;
  /** 中身が絵だけの行に名前を与える（読み上げで「ボタン」としか言われなくなる）。 */
  ariaLabel?: string;
  children: React.ReactNode;
}

/** 紙の上の 1 行。面は持たず、罫 1 本と末尾の › で押せることを示す。 */
function Row({ onClick, testId, ariaLabel, children }: RowProps) {
  return (
    <li className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
      <button
        type="button"
        onClick={onClick}
        data-testid={testId}
        aria-label={ariaLabel}
        className="flex min-h-[52px] w-full items-center gap-3 py-3 text-left"
      >
        {children}
        <span
          aria-hidden="true"
          className="shrink-0 text-[18px] leading-none"
          style={{ ...CONTROL_FONT, color: 'var(--date-color)' }}
        >
          ›
        </span>
      </button>
    </li>
  );
}

function LetterIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 16 16"
      fill="none"
      style={{ color: '#7A3B3F' }}
    >
      <path
        d="M1 4L8 9L15 4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M1 4V12H15V4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
