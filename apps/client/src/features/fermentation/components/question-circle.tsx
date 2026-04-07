'use client';

import type { FermentationDetail } from '@/features/fermentation/hooks/use-fermentation-results';

interface QuestionCircleProps {
  questionText: string;
  detail: FermentationDetail | null;
  zoomed: boolean;
  onClick: () => void;
  onElementClick: (type: 'keyword' | 'snippet' | 'letter', data: Record<string, string>) => void;
  style?: React.CSSProperties;
}

const KEYWORD_ROTATIONS = [-5, 8, -3, 6, -7];
const KEYWORD_POSITIONS = [
  { top: '12%', left: '42%' },
  { top: '25%', left: '70%' },
  { top: '58%', left: '68%' },
  { top: '55%', left: '18%' },
  { top: '25%', left: '16%' },
];
const SNIPPET_POSITIONS = [
  { top: '35%', left: '28%' },
  { top: '38%', left: '55%' },
  { top: '52%', left: '42%' },
];
const LETTER_POSITION = { top: '72%', left: '42%' };

export function QuestionCircle({
  questionText,
  detail,
  zoomed,
  onClick,
  onElementClick,
  style,
}: QuestionCircleProps) {
  const hasData = detail && detail.status === 'completed';

  return (
    <div
      onClick={zoomed ? undefined : onClick}
      role={zoomed ? undefined : 'button'}
      tabIndex={zoomed ? undefined : 0}
      className={`absolute transition-all duration-[1200ms] ${zoomed ? 'z-[55]' : 'z-[3] cursor-pointer'}`}
      style={{
        ...style,
        width: zoomed ? 'min(50vw, 500px)' : 'min(240px, 38vh)',
        height: zoomed ? 'min(50vw, 500px)' : 'min(240px, 38vh)',
        ...(zoomed ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' } : {}),
      }}
    >
      {/* Circle border */}
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox="0 0 200 200">
        <circle
          cx="100"
          cy="100"
          r="90"
          fill="none"
          stroke="#d4a574"
          strokeWidth="1.5"
          opacity="0.6"
        />
        <circle
          cx="100"
          cy="100"
          r="82"
          fill="none"
          stroke="#d4a574"
          strokeWidth="0.5"
          opacity="0.3"
        />
      </svg>

      {/* Question text arc */}
      <svg
        aria-hidden="true"
        className="absolute inset-[-25%] h-[150%] w-[150%]"
        viewBox="0 0 300 300"
      >
        <defs>
          <path
            id={`arc-${questionText.slice(0, 10)}`}
            d="M 150 150 m -120 0 a 120 120 0 1 1 240 0 a 120 120 0 1 1 -240 0"
            fill="none"
          />
        </defs>
        <text
          fill="#6b2c2c"
          fontSize="13"
          fontWeight="500"
          letterSpacing="0.12em"
          style={{ fontFamily: "'Noto Serif JP', serif" }}
        >
          <textPath href={`#arc-${questionText.slice(0, 10)}`} startOffset="5%">
            {questionText}
          </textPath>
        </text>
      </svg>

      {/* Inner content */}
      <div className="absolute inset-0 overflow-visible">
        {hasData ? (
          <>
            {/* Keywords */}
            {detail.keywords.slice(0, 5).map((kw, i) => (
              <div
                key={kw.id}
                onClick={(e) => {
                  if (!zoomed) return;
                  e.stopPropagation();
                  onElementClick('keyword', {
                    keyword: kw.keyword,
                    description: kw.description,
                  });
                }}
                className={`absolute rounded-md bg-[#d4a574] px-2.5 py-1 text-[9px] font-medium text-white shadow-md ${zoomed ? 'cursor-pointer transition-transform hover:scale-110' : ''}`}
                style={{
                  ...KEYWORD_POSITIONS[i],
                  transform: `rotate(${KEYWORD_ROTATIONS[i]}deg)`,
                  fontFamily: "'Noto Serif JP', serif",
                }}
              >
                {kw.keyword}
              </div>
            ))}

            {/* Snippets */}
            {detail.snippets.slice(0, 3).map((s, i) => (
              <div
                key={s.id}
                onClick={(e) => {
                  if (!zoomed) return;
                  e.stopPropagation();
                  onElementClick('snippet', {
                    originalText: s.originalText,
                    sourceDate: s.sourceDate,
                    selectionReason: s.selectionReason,
                  });
                }}
                className={`absolute max-w-[90px] rounded-md border border-[rgba(139,115,85,0.15)] bg-white/80 px-2 py-1.5 text-[7px] leading-tight shadow-sm backdrop-blur-sm ${zoomed ? 'cursor-pointer transition-transform hover:scale-110' : ''}`}
                style={{
                  ...SNIPPET_POSITIONS[i],
                  fontFamily: "'Noto Serif JP', serif",
                }}
              >
                「{s.originalText.substring(0, 20)}...
              </div>
            ))}

            {/* Letter */}
            {detail.letter && (
              <div
                onClick={(e) => {
                  if (!zoomed) return;
                  e.stopPropagation();
                  onElementClick('letter', {
                    bodyText: detail.letter!.bodyText,
                  });
                }}
                className={`absolute ${zoomed ? 'cursor-pointer transition-transform hover:scale-110' : ''}`}
                style={LETTER_POSITION}
              >
                <svg aria-hidden="true" width="48" height="40" viewBox="0 0 48 40" fill="none">
                  <rect
                    x="4"
                    y="8"
                    width="40"
                    height="28"
                    rx="3"
                    fill="#faf5eb"
                    stroke="#c9a96e"
                    strokeWidth="1"
                  />
                  <path d="M4 12l20 14 20-14" stroke="#c9a96e" strokeWidth="1" fill="none" />
                  <circle cx="24" cy="28" r="4" fill="#d4758a" opacity="0.7" />
                </svg>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-center text-xs text-[var(--date-color)] opacity-60">
            発酵中...
          </div>
        )}
      </div>
    </div>
  );
}
