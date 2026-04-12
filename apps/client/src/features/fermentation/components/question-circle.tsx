'use client';

import { useMemo } from 'react';
import type { FermentationDetail } from '@/features/fermentation/hooks/use-fermentation-results';

interface QuestionCircleProps {
  questionId: string;
  questionText: string;
  detail: FermentationDetail | null;
  zoomed: boolean;
  onClick: () => void;
  onElementClick: (type: 'keyword' | 'snippet' | 'letter', data: Record<string, string>) => void;
  style?: React.CSSProperties;
}

/* ── Microbe SVG templates (matching reference) ── */
const MICROBE_SVGS = {
  koji: '<svg viewBox="0 0 28 28"><g fill="none"><path d="M14,24 C10,20 8,14 12,8 C14,6 16,6 18,8 C22,12 22,18 18,22" stroke="#A3B8A8" stroke-width="2" stroke-linecap="round" opacity="0.65"/><ellipse cx="14" cy="6" rx="3.5" ry="5" fill="#A3B8A8" opacity="0.35"/><ellipse cx="9" cy="10" rx="2" ry="3" fill="#8EA89C" opacity="0.45"/><ellipse cx="19" cy="14" rx="1.5" ry="2.5" fill="#8EA89C" opacity="0.3"/></g></svg>',
  yeast:
    '<svg viewBox="0 0 24 36"><g fill="#D9B48F" opacity="0.55"><rect x="8" y="4" width="8" height="20" rx="4" fill="#D9B48F" opacity="0.6"/><rect x="6" y="2" width="5" height="14" rx="2.5" fill="#E2C28E" opacity="0.7"/><rect x="14" y="8" width="4" height="12" rx="2" fill="#D9B48F" opacity="0.45"/><rect x="10" y="20" width="4" height="10" rx="2" fill="#E2C28E" opacity="0.5"/></g></svg>',
  lab: '<svg viewBox="0 0 32 20"><g fill="none"><path d="M6,14 Q12,6 18,12 Q26,18 30,10" stroke="#A3B8A8" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/><circle cx="6" cy="14" r="3" fill="#A3B8A8" opacity="0.4"/><circle cx="18" cy="12" r="2.5" fill="#8EA89C" opacity="0.35"/><circle cx="30" cy="10" r="2" fill="#A3B8A8" opacity="0.3"/></g></svg>',
};
const MICROBE_TYPES: Array<'koji' | 'yeast' | 'lab'> = ['koji', 'yeast', 'lab'];

/* ── Positions for content elements ── */
const KEYWORD_POSITIONS = [
  { top: 20, left: 55 },
  { top: 38, left: 18 },
  { top: 55, left: 65 },
  { top: 72, left: 28 },
  { top: 45, left: 45 },
];
const SNIPPET_POSITIONS = [
  { top: 30, left: 35 },
  { top: 60, left: 15 },
  { top: 50, left: 75 },
];
const LETTER_POSITION = { top: 72, left: 52 };
const FLOAT_CLASSES = ['j2-float-1', 'j2-float-2', 'j2-float-3'];

/* ── Empty state microbe positions ── */
const EMPTY_MICROBE_POSITIONS = [
  { top: 30, left: 40, size: 28 },
  { top: 50, left: 25, size: 24 },
  { top: 60, left: 60, size: 32 },
  { top: 25, left: 65, size: 24 },
  { top: 70, left: 38, size: 28 },
  { top: 40, left: 70, size: 20 },
];

/** Seeded random number generator (same as reference) */
function seededRandom(seed: string): () => number {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = ((s << 5) - s + seed.charCodeAt(i)) | 0;
  return function next(): number {
    s = (s * 16807 + 0) % 2147483647;
    return (s & 0x7fffffff) / 2147483647;
  };
}

/** Generate mycelium SVG paths radiating from center */
function generateMyceliumPaths(size: number, questionId: string): string {
  const cx = size / 2;
  const cy = size / 2;
  const rng = seededRandom(`${questionId}_mycelium`);
  const paths: string[] = [];
  const count = 5;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + 0.3;
    const endR = size / 2 - 20;
    const midR = endR * (0.35 + rng() * 0.3);
    const midAngle = angle + (rng() - 0.5) * 0.6;
    const mx = cx + Math.cos(midAngle) * midR;
    const my = cy + Math.sin(midAngle) * midR;
    const ex = cx + Math.cos(angle) * endR;
    const ey = cy + Math.sin(angle) * endR;
    paths.push(
      `<path d="M${cx},${cy} C ${mx},${my} ${mx},${my} ${ex},${ey}" stroke-dasharray="4 4"/>`,
    );
  }
  return paths.join('\n');
}

export function QuestionCircle({
  questionId,
  questionText,
  detail,
  zoomed,
  onClick,
  onElementClick,
  style,
}: QuestionCircleProps) {
  const hasData = detail && detail.status === 'completed';
  const size = 280;

  const myceliumHtml = useMemo(() => generateMyceliumPaths(size, questionId), [questionId]);

  return (
    <div
      onClick={zoomed ? undefined : onClick}
      role={zoomed ? undefined : 'button'}
      tabIndex={zoomed ? undefined : 0}
      onKeyDown={
        zoomed
          ? undefined
          : (e) => {
              if (e.key === 'Enter') onClick();
            }
      }
      className={`absolute transition-all duration-[600ms] ${zoomed ? 'z-[55]' : 'z-[3] cursor-pointer'}`}
      style={{
        ...style,
        width: zoomed ? 'min(50vw, 75vh, 500px)' : `${size}px`,
        height: zoomed ? 'min(50vw, 75vh, 500px)' : `${size}px`,
        transform: zoomed ? 'translate(-50%, -50%)' : 'translate(-50%, -50%)',
        ...(zoomed ? { top: '50%', left: '50%' } : {}),
        // @ts-expect-error: CSS custom property for element scaling
        '--el-scale': zoomed ? '1.1' : '0.65',
      }}
    >
      {/* Circle keyframes */}
      <style>{`
        @keyframes spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      {/* Circle glow */}
      <div
        style={{
          position: 'absolute',
          inset: '-10%',
          borderRadius: '50%',
          background: 'rgba(217,180,143,0.05)',
          filter: 'blur(30px)',
          animation: 'j2-pulse 4s cubic-bezier(0.4,0,0.6,1) infinite',
        }}
      />

      {/* Rotating question text ring */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: '100%',
          height: '100%',
          animation: 'spin 120s linear infinite',
          pointerEvents: 'none',
        }}
      >
        <svg aria-hidden="true" viewBox={`0 0 ${size} ${size}`} className="h-full w-full">
          <path
            id={`ring-${questionId}`}
            d={`M ${size / 2},${size / 2} m ${-(size / 2 - 12)},0 a ${size / 2 - 12},${size / 2 - 12} 0 1,1 ${size - 24},0 a ${size / 2 - 12},${size / 2 - 12} 0 1,1 ${-(size - 24)},0`}
            fill="transparent"
          />
          <text
            style={{
              fontFamily: "'Noto Serif JP', serif",
              fontSize: '9px',
              letterSpacing: '0.2em',
              fill: '#7A3B3F',
              opacity: 0.6,
            }}
          >
            <textPath href={`#ring-${questionId}`} startOffset="0%">
              {questionText} &bull;{' '}
            </textPath>
          </text>
        </svg>
      </div>

      {/* Mycelium lines (counter-rotating) */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: '100%',
          height: '100%',
          animation: 'spin 120s linear infinite reverse',
          pointerEvents: 'none',
        }}
      >
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="h-full w-full"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: static generated SVG paths, no user input
          dangerouslySetInnerHTML={{
            __html: `<g stroke="rgba(226,194,142,0.6)" stroke-width="1.2" fill="none" stroke-linecap="round">${myceliumHtml}</g>`,
          }}
        />
      </div>

      {/* Inner content */}
      <div
        className="absolute overflow-visible"
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          pointerEvents: zoomed ? 'auto' : 'none',
        }}
      >
        {hasData ? (
          <div
            style={{
              animation: 'fadeIn 0.5s ease-out forwards',
            }}
          >
            {/* Keywords with attached microbe */}
            {detail.keywords.slice(0, 5).map((kw, i) => {
              const pos = KEYWORD_POSITIONS[i] ?? { top: 35 + i * 12, left: 20 + i * 15 };
              const mType = MICROBE_TYPES[i % 3];
              return (
                <div
                  key={kw.id}
                  className={FLOAT_CLASSES[i % 3]}
                  style={{
                    position: 'absolute',
                    top: `${pos.top}%`,
                    left: `${pos.left}%`,
                    transform: 'scale(var(--el-scale))',
                    transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  <div
                    onClick={(e) => {
                      if (!zoomed) return;
                      e.stopPropagation();
                      onElementClick('keyword', {
                        keyword: kw.keyword,
                        description: kw.description,
                      });
                    }}
                    className={zoomed ? 'cursor-pointer' : ''}
                    style={{
                      position: 'relative',
                      zIndex: 10,
                      background: 'linear-gradient(135deg, #E8D1B5, #D9B48F)',
                      color: 'var(--text)',
                      fontFamily: "'Noto Serif JP', serif",
                      fontSize: zoomed ? '13px' : '11px',
                      letterSpacing: '0.15em',
                      padding: zoomed ? '8px 20px' : '6px 16px',
                      borderRadius: '999px',
                      boxShadow: '0 4px 12px rgba(217,180,143,0.3)',
                      border: '1px solid rgba(255,255,255,0.5)',
                      whiteSpace: 'nowrap',
                      transition: 'transform 0.5s',
                    }}
                  >
                    {kw.keyword}
                    <span
                      className="pointer-events-none absolute -top-2.5 -right-3 block h-[18px] w-[18px] opacity-60"
                      // biome-ignore lint/security/noDangerouslySetInnerHtml: static constant SVG
                      dangerouslySetInnerHTML={{ __html: MICROBE_SVGS[mType] }}
                    />
                  </div>
                </div>
              );
            })}

            {/* Snippets with attached microbe */}
            {detail.snippets.slice(0, 3).map((s, i) => {
              const pos = SNIPPET_POSITIONS[i] ?? { top: 40 + i * 18, left: 25 + i * 20 };
              const mType = MICROBE_TYPES[(i + 1) % 3];
              const displayText =
                s.originalText.length > 60 ? `${s.originalText.substring(0, 60)}…` : s.originalText;
              return (
                <div
                  key={s.id}
                  className={FLOAT_CLASSES[(i + 1) % 3]}
                  style={{
                    position: 'absolute',
                    top: `${pos.top}%`,
                    left: `${pos.left}%`,
                    transform: 'scale(var(--el-scale))',
                    transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  <div
                    onClick={(e) => {
                      if (!zoomed) return;
                      e.stopPropagation();
                      onElementClick('snippet', {
                        originalText: s.originalText,
                        sourceDate: s.sourceDate,
                        selectionReason: s.selectionReason,
                      });
                    }}
                    className={zoomed ? 'cursor-pointer' : ''}
                    style={{
                      position: 'relative',
                      zIndex: 20,
                      background: 'rgba(253,251,247,0.4)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      border: '1px solid rgba(255,255,255,0.6)',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      maxWidth: zoomed ? '200px' : '140px',
                      boxShadow: '0 4px 16px rgba(140,133,126,0.08)',
                      transition: 'all 0.3s',
                    }}
                  >
                    <p
                      style={{
                        fontSize: zoomed ? '11px' : '9px',
                        color: 'var(--text)',
                        lineHeight: 1.6,
                        fontFamily: "'Noto Sans JP', sans-serif",
                        fontWeight: 500,
                        opacity: 0.95,
                        margin: 0,
                      }}
                    >
                      「{displayText}
                    </p>
                    {/* Dot indicator */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '-6px',
                        left: '24px',
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: '#E2C28E',
                        border: '1px solid white',
                        boxShadow: '0 0 4px rgba(226,194,142,0.4)',
                      }}
                    />
                    <span
                      className="pointer-events-none absolute -bottom-2.5 -left-2 block h-[18px] w-[18px] opacity-60"
                      // biome-ignore lint/security/noDangerouslySetInnerHtml: static constant SVG
                      dangerouslySetInnerHTML={{ __html: MICROBE_SVGS[mType] }}
                    />
                  </div>
                </div>
              );
            })}

            {/* Letter with attached microbe */}
            {detail.letter && (
              <div
                className="j2-float-2"
                style={{
                  position: 'absolute',
                  top: `${LETTER_POSITION.top}%`,
                  left: `${LETTER_POSITION.left}%`,
                  transform: 'scale(var(--el-scale))',
                  transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                <div
                  onClick={(e) => {
                    if (!zoomed) return;
                    e.stopPropagation();
                    onElementClick('letter', { bodyText: detail.letter!.bodyText });
                  }}
                  className={zoomed ? 'cursor-pointer' : ''}
                  style={{
                    position: 'relative',
                    zIndex: 20,
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, white, #FDFBF7)',
                    boxShadow: '0 4px 12px rgba(140,133,126,0.15)',
                    border: '1px solid rgba(140,133,126,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.3s',
                  }}
                >
                  <svg
                    aria-hidden="true"
                    width="16"
                    height="16"
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
                    <path
                      d="M5 8L1 12"
                      stroke="currentColor"
                      strokeWidth="0.8"
                      strokeLinecap="round"
                      opacity="0.6"
                    />
                    <path
                      d="M11 8L15 12"
                      stroke="currentColor"
                      strokeWidth="0.8"
                      strokeLinecap="round"
                      opacity="0.6"
                    />
                  </svg>
                  {/* Dot indicator */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '-6px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#E2C28E',
                      border: '1px solid white',
                    }}
                  />
                  <span
                    className="pointer-events-none absolute -top-2.5 -right-3 block h-[18px] w-[18px] opacity-60"
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: static constant SVG
                    dangerouslySetInnerHTML={{ __html: MICROBE_SVGS.lab }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Empty state: floating microbes */
          EMPTY_MICROBE_POSITIONS.map((p, i) => {
            const type = MICROBE_TYPES[i % 3];
            return (
              <div
                key={`empty-${type}-${p.top}-${p.left}`}
                className={`j2-float-${(i % 3) + 1}`}
                style={{
                  position: 'absolute',
                  top: `${p.top}%`,
                  left: `${p.left}%`,
                  width: `${p.size}px`,
                  height: `${p.size}px`,
                  opacity: 0.45,
                  pointerEvents: 'none',
                }}
                // biome-ignore lint/security/noDangerouslySetInnerHtml: static constant SVG
                dangerouslySetInnerHTML={{ __html: MICROBE_SVGS[type] }}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
