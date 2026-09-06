'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import type { FermentationDetail } from '@/features/shared/fermentation/types';
import type { SpJarElement } from '@/features/sp/fermentation/components/sp-element-sheet';
import { fitRingText, RING_TRACKING, ringPath } from '@/features/sp/fermentation/ring-text';
import { ringSlots } from '@/features/sp/fermentation/zoom-layout';

/** 円の中での位置（円の直径に対する %）。 */
export interface ZoomPosition {
  xPercent: number;
  yPercent: number;
}

interface SpQuestionZoomProps {
  questionText: string;
  detail: FermentationDetail | null;
  loading: boolean;
  onClose: () => void;
  onOpenElement: (element: SpJarElement) => void;
  /**
   * 動かした要素の位置（id → 位置）。無い要素は輪の上の既定位置に置く。
   * 保存は呼び出し側（page/瓶）が持つ — この部品は置き場を知らない。
   */
  positions?: Record<string, ZoomPosition>;
  onMove?: (id: string, position: ZoomPosition) => void;
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
  positions = {},
  onMove,
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
  const scale = elementScale(size);

  /** 動かしてあればその位置、無ければ輪の上の既定位置。 */
  const placed = (id: string, fallback: ZoomPosition | undefined): ZoomPosition | undefined =>
    positions[id] ?? fallback;

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
      {/* 問いは円の外周に書いてある。ここでもう一度出すと同じ文が 2 つ並ぶだけなので、
          閉じる導線だけを置く。 */}
      <header className="flex items-center justify-end px-5 py-4">
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
            // 長い問いは輪が外へ増えるので、その分だけ円を控えめにする
            // （88vw のままだと 2 重目が画面の縁で切れる）。
            width: 'min(80vw, 52vh)',
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
              viewBox={`0 0 ${ring.box} ${ring.box}`}
              className="pointer-events-none absolute"
              style={{
                left: '50%',
                top: '50%',
                width: `${ring.box}px`,
                height: `${ring.box}px`,
                marginLeft: `${-ring.box / 2}px`,
                marginTop: `${-ring.box / 2}px`,
              }}
            >
              {ring.lines.map((line) => (
                <g key={line.radius}>
                  <path
                    id={`sp-zoom-ring-${Math.round(line.radius)}`}
                    d={ringPath(ring.box / 2, line.radius)}
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
                    <textPath
                      href={`#sp-zoom-ring-${Math.round(line.radius)}`}
                      startOffset="25%"
                      textAnchor="middle"
                    >
                      {line.label}
                    </textPath>
                  </text>
                </g>
              ))}
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
              slot={placed(keyword.id, keywordSlots[i])}
              id={keyword.id}
              onMove={onMove}
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
              slot={placed(snippet.id, snippetSlots[i])}
              id={snippet.id}
              onMove={onMove}
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
              slot={placed(letter.id, { xPercent: 50, yPercent: 50 })}
              id={letter.id}
              onMove={onMove}
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
  /** 要素の id。動かした位置を憶えるときの鍵。 */
  id: string;
  slot: ZoomPosition | undefined;
  /** 円の大きさに合わせた倍率。位置は % なので、寸法だけをここで合わせる。 */
  scale: number;
  onClick: () => void;
  onMove?: (id: string, position: ZoomPosition) => void;
  /** 手紙のように文字を持たない要素を掴むための目印。 */
  testId?: string;
  /** 中身が絵だけの要素に名前を与える（読み上げで「ボタン」としか言われなくなる）。 */
  ariaLabel?: string;
  children: React.ReactNode;
}

/** これ以上動いたらタップではなく動かした、とみなす（px）。 */
const DRAG_SLOP = 6;

/**
 * 円の中の要素。**タップで読み、ドラッグで動かす。**
 *
 * click は pointerup の後に来るので、動かし終えた指離しで中身が開かないよう、
 * 動かしたかどうかを次の click まで持ち越す（軌道の円と同じ作り）。
 */
function ElementButton({
  id,
  slot,
  scale,
  onClick,
  onMove,
  testId,
  ariaLabel,
  children,
}: ElementButtonProps) {
  const draggedRef = useRef(false);
  const originRef = useRef<{ x: number; y: number; moved: number } | null>(null);

  if (!slot) return null;

  const circle = (event: React.PointerEvent<HTMLElement>): DOMRect | null =>
    event.currentTarget.parentElement?.getBoundingClientRect() ?? null;

  return (
    <button
      type="button"
      onClick={() => {
        if (draggedRef.current) {
          draggedRef.current = false;
          return;
        }
        onClick();
      }}
      onPointerDown={(event) => {
        if (!onMove) return;
        draggedRef.current = false;
        originRef.current = { x: event.clientX, y: event.clientY, moved: 0 };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const origin = originRef.current;
        if (!onMove || !origin) return;
        origin.moved += Math.abs(event.clientX - origin.x) + Math.abs(event.clientY - origin.y);
        origin.x = event.clientX;
        origin.y = event.clientY;
        if (origin.moved < DRAG_SLOP) return;

        const rect = circle(event);
        if (!rect || rect.width === 0) return;
        draggedRef.current = true;
        // 円からはみ出さない範囲に留める（外へ出すと二度と掴めない）。
        onMove(id, {
          xPercent: clampPercent(((event.clientX - rect.left) / rect.width) * 100),
          yPercent: clampPercent(((event.clientY - rect.top) / rect.height) * 100),
        });
      }}
      onPointerUp={() => {
        originRef.current = null;
      }}
      onPointerCancel={() => {
        originRef.current = null;
        draggedRef.current = false;
      }}
      data-testid={testId}
      aria-label={ariaLabel}
      className="absolute"
      style={{
        left: `${slot.xPercent}%`,
        top: `${slot.yPercent}%`,
        transform: `translate(-50%, -50%) scale(${scale})`,
        touchAction: 'none',
        cursor: onMove ? 'grab' : undefined,
      }}
    >
      {children}
    </button>
  );
}

/** 円の内側（縁から少し内）に収める。 */
function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(92, Math.max(8, value));
}
