'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import type { FermentationDetail } from '@/features/shared/fermentation/types';
import type { SpJarElement } from '@/features/sp/fermentation/components/sp-element-sheet';
import { fitRingText, RING_INSET, RING_TRACKING } from '@/features/sp/fermentation/ring-text';
import { ringSlots } from '@/features/sp/fermentation/zoom-layout';

interface SpQuestionZoomProps {
  questionText: string;
  detail: FermentationDetail | null;
  loading: boolean;
  onClose: () => void;
  onOpenElement: (element: SpJarElement) => void;
}

/**
 * 内側の輪＝言葉、外側の輪＝抜粋。
 *
 * 抜粋は 3 時から、言葉は 12 時から並べる。数が少ないとき（言葉2・抜粋1 が典型）に
 * 上下と左右で席が分かれ、いちばん混みやすい真上で重ならない。
 */
const KEYWORD_RADIUS = 27;
const SNIPPET_RADIUS = 34;
const KEYWORD_START = 0;
const SNIPPET_START = Math.PI / 2;

/** 円の中に置ける数の上限。これ以上は入れても指で選び分けられない。 */
const MAX_KEYWORDS = 6;
const MAX_SNIPPETS = 4;

/**
 * 中の要素を設計した円の直径（px）。実際の円がこれより小さければ要素も縮める。
 *
 * 位置は % なので円と一緒に縮むが、ピルやカードの寸法は絶対 px なので、
 * 小さい端末では相対的に肥大して円からはみ出す。倍率で吸収する。
 */
const ELEMENT_REFERENCE_SIZE = 340;
const ELEMENT_SCALE_MIN = 0.85;
const ELEMENT_SCALE_MAX = 1.35;

function elementScale(size: number): number {
  if (size <= 0) return 1;
  const raw = size / ELEMENT_REFERENCE_SIZE;
  return Math.min(ELEMENT_SCALE_MAX, Math.max(ELEMENT_SCALE_MIN, raw));
}

/**
 * 問いの円をひとつ開いた画面。円が画面いっぱいに広がり、中の要素（言葉・抜粋・手紙）が
 * それぞれタップできる。
 *
 * 円の中では**中身を読ませない**。読むのはボトムシート（SpElementSheet）の仕事で、
 * ここは「何がいくつ入っているか」と「どれを触るか」だけを示す。
 */
export function SpQuestionZoom({
  questionText,
  detail,
  loading,
  onClose,
  onOpenElement,
}: SpQuestionZoomProps) {
  const t = useTranslations('sp.jar');
  const circleRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState(0);

  useEffect(() => {
    const el = circleRef.current;
    if (!el) return;
    const update = () => setSize(el.getBoundingClientRect().width);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const keywords = detail ? detail.keywords.slice(0, MAX_KEYWORDS) : [];
  const snippets = detail ? detail.snippets.slice(0, MAX_SNIPPETS) : [];
  const letter = detail?.letter ?? null;
  const keywordSlots = ringSlots(keywords.length, KEYWORD_RADIUS, KEYWORD_START);
  const snippetSlots = ringSlots(snippets.length, SNIPPET_RADIUS, SNIPPET_START);
  const empty = !loading && keywords.length === 0 && snippets.length === 0 && letter === null;

  const ring = fitRingText(questionText, size);
  const radius = size / 2 - RING_INSET;
  const scale = elementScale(size);

  return (
    <div
      className="sp-rise absolute inset-0 z-20 flex flex-col"
      style={{ background: 'var(--bg)', fontFamily: 'var(--ob-font-serif)' }}
      {...verifyAttrs({
        unit: 'SpQuestionZoom',
        loading,
        keywordCount: keywords.length,
        snippetCount: snippets.length,
        hasLetter: letter !== null,
        empty,
      })}
    >
      <header className="flex items-center justify-between gap-3 px-5 py-4">
        <p className="min-w-0 flex-1 truncate text-sm">{questionText}</p>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-xs"
          style={{ color: 'var(--date-color)' }}
        >
          {t('close')}
        </button>
      </header>

      <div className="flex flex-1 items-center justify-center px-4">
        <div
          ref={circleRef}
          className="relative aspect-square rounded-full"
          style={{
            width: 'min(88vw, 56vh)',
            background:
              'radial-gradient(circle at 50% 42%, rgba(253,251,247,0.75), rgba(253,251,247,0.15))',
            border: '1px solid rgba(226,194,142,0.5)',
            boxShadow: '0 8px 40px rgba(140,133,126,0.12)',
          }}
        >
          {/* 外周を回る問いテキスト。開いてもここが「どの問いか」を語る。 */}
          {size > 0 ? (
            <svg
              aria-hidden="true"
              viewBox={`0 0 ${size} ${size}`}
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              <path
                id="sp-zoom-ring"
                d={`M ${size / 2},${size / 2} m ${-radius},0 a ${radius},${radius} 0 1,1 ${radius * 2},0 a ${radius},${radius} 0 1,1 ${-radius * 2},0`}
                fill="transparent"
              />
              <text
                style={{
                  fontFamily: "'Noto Serif JP', serif",
                  fontSize: `${ring.fontSize}px`,
                  letterSpacing: `${RING_TRACKING}em`,
                  fill: '#7A3B3F',
                  opacity: 0.7,
                }}
              >
                {/* 経路は 9 時から時計回り。25% ＝ 12 時に中央を合わせて、
                    問いが円の上を渡るようにする（0% だと左側面から始まって読みにくい）。 */}
                <textPath href="#sp-zoom-ring" startOffset="25%" textAnchor="middle">
                  {ring.label}
                </textPath>
              </text>
            </svg>
          ) : null}

          {loading ? (
            <p
              className="absolute inset-0 flex items-center justify-center text-xs"
              style={{ color: 'var(--date-color)' }}
            >
              …
            </p>
          ) : null}

          {empty ? (
            <p
              className="absolute inset-0 flex items-center justify-center px-12 text-center text-sm leading-relaxed"
              style={{ color: 'var(--date-color)' }}
            >
              {t('not_fermented')}
            </p>
          ) : null}

          {/* 言葉（内側の輪） */}
          {keywords.map((keyword, i) => (
            <ElementButton
              key={keyword.id}
              slot={keywordSlots[i]}
              scale={scale}
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
                className="block whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px]"
                style={{
                  background: 'linear-gradient(135deg, #E8D1B5, #D9B48F)',
                  color: 'var(--fg)',
                  border: '1px solid rgba(255,255,255,0.5)',
                  boxShadow: '0 4px 12px rgba(217,180,143,0.3)',
                  letterSpacing: '0.08em',
                }}
              >
                {keyword.keyword}
              </span>
            </ElementButton>
          ))}

          {/* 抜粋（外側の輪）。中身は読ませず、在ることだけ示す。 */}
          {snippets.map((snippet, i) => (
            <ElementButton
              key={snippet.id}
              slot={snippetSlots[i]}
              scale={scale}
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
              <span
                className="block w-[92px] rounded-xl px-2.5 py-2 text-[11px] leading-snug"
                style={{
                  background: 'rgba(253,251,247,0.85)',
                  border: '1px solid rgba(255,255,255,0.7)',
                  boxShadow: '0 4px 16px rgba(140,133,126,0.10)',
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 2,
                  overflow: 'hidden',
                }}
              >
                「{snippet.originalText}
              </span>
            </ElementButton>
          ))}

          {/* 手紙（中央）。円の中でいちばん強い報酬なので席は真ん中。 */}
          {letter ? (
            <ElementButton
              slot={{ xPercent: 50, yPercent: 50 }}
              scale={scale}
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
                className="flex items-center justify-center rounded-full"
                style={{
                  width: '82px',
                  height: '82px',
                  background: 'linear-gradient(135deg, #FFFFFF, #FBF1EE)',
                  border: '1.5px solid rgba(122,59,63,0.45)',
                  boxShadow: '0 0 0 6px rgba(122,59,63,0.06), 0 6px 18px rgba(122,59,63,0.22)',
                }}
              >
                <svg
                  aria-hidden="true"
                  width="26"
                  height="26"
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
              </span>
            </ElementButton>
          ) : null}
        </div>
      </div>

      <p
        className="px-6 pb-6 text-center text-[11px]"
        style={{ color: 'var(--date-color)', fontFamily: 'var(--ob-font-sans)' }}
      >
        {empty || loading ? '' : t('tap_hint')}
      </p>
    </div>
  );
}

interface ElementButtonProps {
  slot: { xPercent: number; yPercent: number } | undefined;
  /** 円の大きさに合わせた倍率。位置は % なので、寸法だけをここで合わせる。 */
  scale: number;
  onClick: () => void;
  /** 手紙のように文字を持たない要素を掴むための目印。 */
  testId?: string;
  /** 中身が絵だけの要素に名前を与える（読み上げで「ボタン」としか言われなくなる）。 */
  ariaLabel?: string;
  children: React.ReactNode;
}

function ElementButton({ slot, scale, onClick, testId, ariaLabel, children }: ElementButtonProps) {
  if (!slot) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      aria-label={ariaLabel}
      className="absolute"
      style={{
        left: `${slot.xPercent}%`,
        top: `${slot.yPercent}%`,
        transform: `translate(-50%, -50%) scale(${scale})`,
      }}
    >
      {children}
    </button>
  );
}
