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
  { top: '10%', left: '40%' },
  { top: '22%', left: '72%' },
  { top: '60%', left: '70%' },
  { top: '58%', left: '14%' },
  { top: '22%', left: '14%' },
];
const SNIPPET_ROTATIONS = [-12, 8, -5];
const SNIPPET_POSITIONS = [
  { top: '32%', left: '20%' },
  { top: '36%', left: '50%' },
  { top: '50%', left: '36%' },
];
const LETTER_POSITION = { top: '74%', left: '42%' };

/* Microbe SVG icons */
function YeastIcon() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 20 20"
      className="absolute -top-1 -right-1"
    >
      <ellipse cx="10" cy="12" rx="6" ry="5" fill="#d4a050" opacity="0.8" />
      <ellipse cx="14" cy="7" rx="3.5" ry="3" fill="#d4a050" opacity="0.6" />
    </svg>
  );
}

function KojiIcon() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 20 20"
      className="absolute -top-1 -right-1"
    >
      <line x1="10" y1="18" x2="10" y2="6" stroke="#8b5cf6" strokeWidth="1.5" opacity="0.7" />
      <circle cx="7" cy="5" r="2" fill="#8b5cf6" opacity="0.6" />
      <circle cx="13" cy="7" r="1.5" fill="#8b5cf6" opacity="0.5" />
      <circle cx="10" cy="3" r="1.8" fill="#8b5cf6" opacity="0.7" />
    </svg>
  );
}

function LabIcon() {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
      viewBox="0 0 16 16"
      className="absolute -top-1 -left-1"
    >
      <ellipse cx="8" cy="8" rx="4" ry="3" fill="#059669" opacity="0.6" />
      <ellipse cx="5" cy="6" rx="2.5" ry="2" fill="#059669" opacity="0.5" />
    </svg>
  );
}

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
      onKeyDown={
        zoomed
          ? undefined
          : (e) => {
              if (e.key === 'Enter') onClick();
            }
      }
      className={`absolute transition-all duration-[1200ms] ease-[cubic-bezier(0.19,1,0.22,1)] ${zoomed ? 'z-[55]' : 'z-[3] cursor-pointer'}`}
      style={{
        ...style,
        width: zoomed ? 'min(50vw, 75vh, 500px)' : 'min(240px, 38vh)',
        height: zoomed ? 'min(50vw, 75vh, 500px)' : 'min(240px, 38vh)',
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
        className="absolute inset-[-20%] h-[140%] w-[140%]"
        viewBox="0 0 280 280"
      >
        <defs>
          <path
            id={`arc-${questionText.slice(0, 10)}`}
            d="M 140 140 m -110 0 a 110 110 0 1 1 220 0 a 110 110 0 1 1 -220 0"
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
            {/* Keywords with yeast icon */}
            {detail.keywords.slice(0, 5).map((kw, i) => (
              <div
                key={kw.id}
                onClick={(e) => {
                  if (!zoomed) return;
                  e.stopPropagation();
                  onElementClick('keyword', { keyword: kw.keyword, description: kw.description });
                }}
                className={`absolute animate-[float_${3 + i * 0.5}s_ease-in-out_infinite] rounded-md bg-[#d4a574] px-2.5 py-1 text-[9px] font-medium text-white ${zoomed ? 'cursor-pointer transition-transform hover:scale-[1.15]' : ''}`}
                style={{
                  ...KEYWORD_POSITIONS[i],
                  transform: `rotate(${KEYWORD_ROTATIONS[i]}deg)`,
                  fontFamily: "'Noto Serif JP', serif",
                  boxShadow: '0 4px 15px rgba(212,165,116,0.3)',
                  animationDelay: `${i * 0.4}s`,
                }}
              >
                <div className="relative">
                  {kw.keyword}
                  <YeastIcon />
                </div>
              </div>
            ))}

            {/* Snippets with koji icon + rotation */}
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
                className={`absolute max-w-[140px] animate-[float_${3.5 + i * 0.6}s_ease-in-out_infinite] rounded-md border border-[rgba(139,115,85,0.15)] bg-white/80 px-2.5 py-2 text-[8px] leading-snug shadow-sm backdrop-blur-sm ${zoomed ? 'cursor-pointer transition-transform hover:scale-[1.15]' : ''}`}
                style={{
                  ...SNIPPET_POSITIONS[i],
                  transform: `rotate(${SNIPPET_ROTATIONS[i]}deg)`,
                  fontFamily: "'Noto Serif JP', serif",
                  animationDelay: `${1 + i * 0.5}s`,
                }}
              >
                <div className="relative">
                  「{s.originalText.substring(0, 25)}...
                  <KojiIcon />
                </div>
              </div>
            ))}

            {/* Letter with lab icon */}
            {detail.letter && (
              <div
                onClick={(e) => {
                  if (!zoomed) return;
                  e.stopPropagation();
                  onElementClick('letter', { bodyText: detail.letter!.bodyText });
                }}
                className={`absolute animate-[float_4s_ease-in-out_infinite] ${zoomed ? 'cursor-pointer transition-transform hover:scale-[1.15]' : ''}`}
                style={{ ...LETTER_POSITION, transform: 'rotate(3deg)', animationDelay: '2s' }}
              >
                <div className="relative">
                  <LabIcon />
                  <svg aria-hidden="true" width="56" height="46" viewBox="0 0 56 46" fill="none">
                    <rect
                      x="4"
                      y="8"
                      width="48"
                      height="34"
                      rx="3"
                      fill="#faf5eb"
                      stroke="#c9a96e"
                      strokeWidth="1"
                    />
                    <path d="M4 14l24 16 24-16" stroke="#c9a96e" strokeWidth="1" fill="none" />
                    <circle cx="28" cy="34" r="5" fill="#d4758a" opacity="0.7" />
                  </svg>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Empty state: microbe placeholders */
          <div className="flex h-full items-center justify-center">
            <div className="flex gap-4 opacity-40">
              <svg aria-hidden="true" width="24" height="24" viewBox="0 0 20 20">
                <ellipse cx="10" cy="12" rx="6" ry="5" fill="#d4a050" />
                <ellipse cx="14" cy="7" rx="3.5" ry="3" fill="#d4a050" opacity="0.6" />
              </svg>
              <svg aria-hidden="true" width="24" height="24" viewBox="0 0 20 20">
                <line x1="10" y1="18" x2="10" y2="6" stroke="#8b5cf6" strokeWidth="1.5" />
                <circle cx="7" cy="5" r="2" fill="#8b5cf6" />
                <circle cx="13" cy="7" r="1.5" fill="#8b5cf6" opacity="0.7" />
              </svg>
              <svg aria-hidden="true" width="24" height="24" viewBox="0 0 16 16">
                <ellipse cx="8" cy="8" rx="4" ry="3" fill="#059669" />
                <ellipse cx="5" cy="6" rx="2.5" ry="2" fill="#059669" opacity="0.6" />
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
