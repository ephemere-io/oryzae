'use client';

import { useTranslations } from 'next-intl';
import { type CSSProperties, type ReactNode, useCallback, useRef, useState } from 'react';
import {
  type FermentationOverlayDetailData,
  FermentationOverlayDetailPane,
  type FermentationOverlayDetailType,
} from '@/features/entries/components/fermentation-overlay-detail-pane';
import type { EntryFermentationDetail } from '@/features/entries/hooks/use-entry-fermentation-detail';
import { useOverlayDrag } from '@/features/entries/hooks/use-overlay-drag';

interface FermentationOverlayProps {
  detail: EntryFermentationDetail;
}

interface Pos {
  x: number;
  y: number;
}

/* Fallback positions when the user hasn't dragged yet. Spread across the editor viewport so
 * elements don't pile onto each other. */
const KEYWORD_FALLBACK_POSITIONS: Pos[] = [
  { x: 12, y: 18 },
  { x: 72, y: 22 },
  { x: 16, y: 68 },
  { x: 76, y: 64 },
  { x: 44, y: 12 },
];
const SNIPPET_FALLBACK_POSITIONS: Pos[] = [
  { x: 22, y: 42 },
  { x: 64, y: 46 },
  { x: 40, y: 78 },
];
const LETTER_FALLBACK_POSITION: Pos = { x: 50, y: 32 };

const FLOAT_CLASSES = ['oz-overlay-float-1', 'oz-overlay-float-2', 'oz-overlay-float-3'];
const MICROBE_TYPES: Array<'koji' | 'yeast' | 'lab'> = ['koji', 'yeast', 'lab'];
const MICROBE_SVGS: Record<'koji' | 'yeast' | 'lab', string> = {
  koji: '<svg viewBox="0 0 28 28"><g fill="none"><path d="M14,24 C10,20 8,14 12,8 C14,6 16,6 18,8 C22,12 22,18 18,22" stroke="#A3B8A8" stroke-width="2" stroke-linecap="round" opacity="0.65"/><ellipse cx="14" cy="6" rx="3.5" ry="5" fill="#A3B8A8" opacity="0.35"/><ellipse cx="9" cy="10" rx="2" ry="3" fill="#8EA89C" opacity="0.45"/><ellipse cx="19" cy="14" rx="1.5" ry="2.5" fill="#8EA89C" opacity="0.3"/></g></svg>',
  yeast:
    '<svg viewBox="0 0 24 36"><g fill="#D9B48F" opacity="0.55"><rect x="8" y="4" width="8" height="20" rx="4" fill="#D9B48F" opacity="0.6"/><rect x="6" y="2" width="5" height="14" rx="2.5" fill="#E2C28E" opacity="0.7"/><rect x="14" y="8" width="4" height="12" rx="2" fill="#D9B48F" opacity="0.45"/><rect x="10" y="20" width="4" height="10" rx="2" fill="#E2C28E" opacity="0.5"/></g></svg>',
  lab: '<svg viewBox="0 0 32 20"><g fill="none"><path d="M6,14 Q12,6 18,12 Q26,18 30,10" stroke="#A3B8A8" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/><circle cx="6" cy="14" r="3" fill="#A3B8A8" opacity="0.4"/><circle cx="18" cy="12" r="2.5" fill="#8EA89C" opacity="0.35"/><circle cx="30" cy="10" r="2" fill="#A3B8A8" opacity="0.3"/></g></svg>',
};

interface FloatingElementProps {
  containerRef: React.RefObject<HTMLElement | null>;
  pos: Pos;
  onMove: (x: number, y: number) => void;
  onEnd: (x: number, y: number) => void;
  onClick: () => void;
  floatClass: string;
  children: ReactNode;
  style?: CSSProperties;
  ariaLabel: string;
}

function FloatingElement({
  containerRef,
  pos,
  onMove,
  onEnd,
  onClick,
  floatClass,
  children,
  style,
  ariaLabel,
}: FloatingElementProps) {
  const { isDragging, pointerHandlers } = useOverlayDrag({
    containerRef,
    enabled: true,
    x: pos.x,
    y: pos.y,
    onClickWithoutDrag: onClick,
    onDragMove: onMove,
    onDragEnd: onEnd,
  });
  return (
    <button
      type="button"
      {...pointerHandlers}
      aria-label={ariaLabel}
      className={`pointer-events-auto border-none bg-transparent p-0 text-left ${floatClass}`}
      style={{
        position: 'absolute',
        top: `${pos.y}%`,
        left: `${pos.x}%`,
        transform: 'translate(-50%, -50%)',
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        userSelect: 'none',
        zIndex: 20,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/**
 * Issue #329: 新規エントリ編集中、紐付けた問いに完了済み発酵結果がある場合に表示する
 * フローティング・オーバーレイ。oryzae のスニペット、yeast のキーワード、L.A.B. の手紙を
 * エディタ上をふわふわ漂わせる。各要素はドラッグで自由に動かせ、クリックすると右側に
 * 詳細ペインが開く。書き込みを妨げないようコンテナ自体は `pointer-events: none` で、
 * 子要素のみが `pointer-events: auto` で操作を受け取る。
 */
export function FermentationOverlay({ detail }: FermentationOverlayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const t = useTranslations('editor.fermentation_overlay');
  const [positions, setPositions] = useState<{
    keywords: Record<string, Pos>;
    snippets: Record<string, Pos>;
    letter: Pos | null;
  }>(() => ({ keywords: {}, snippets: {}, letter: null }));
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailType, setDetailType] = useState<FermentationOverlayDetailType | null>(null);
  const [detailData, setDetailData] = useState<FermentationOverlayDetailData | null>(null);

  const openDetail = useCallback(
    (type: FermentationOverlayDetailType, data: FermentationOverlayDetailData) => {
      setDetailType(type);
      setDetailData(data);
      setDetailOpen(true);
    },
    [],
  );

  const updateKeyword = useCallback((id: string, x: number, y: number) => {
    setPositions((prev) => ({ ...prev, keywords: { ...prev.keywords, [id]: { x, y } } }));
  }, []);
  const updateSnippet = useCallback((id: string, x: number, y: number) => {
    setPositions((prev) => ({ ...prev, snippets: { ...prev.snippets, [id]: { x, y } } }));
  }, []);
  const updateLetter = useCallback((x: number, y: number) => {
    setPositions((prev) => ({ ...prev, letter: { x, y } }));
  }, []);

  return (
    <>
      <style>{`
        @keyframes oz-overlay-float-1 {
          0%, 100% { transform: translate(-50%, -50%) translateY(0) translateX(0); }
          33% { transform: translate(-50%, -50%) translateY(-10px) translateX(5px); }
          66% { transform: translate(-50%, -50%) translateY(5px) translateX(-5px); }
        }
        @keyframes oz-overlay-float-2 {
          0%, 100% { transform: translate(-50%, -50%) translateY(0) translateX(0); }
          33% { transform: translate(-50%, -50%) translateY(5px) translateX(-8px); }
          66% { transform: translate(-50%, -50%) translateY(-8px) translateX(3px); }
        }
        @keyframes oz-overlay-float-3 {
          0%, 100% { transform: translate(-50%, -50%) translateY(0) translateX(0); }
          33% { transform: translate(-50%, -50%) translateY(-6px) translateX(-4px); }
          66% { transform: translate(-50%, -50%) translateY(8px) translateX(6px); }
        }
        .oz-overlay-float-1 { animation: oz-overlay-float-1 8s ease-in-out infinite; }
        .oz-overlay-float-2 { animation: oz-overlay-float-2 12s ease-in-out infinite; }
        .oz-overlay-float-3 { animation: oz-overlay-float-3 10s ease-in-out infinite 2s; }
      `}</style>

      <div
        ref={containerRef}
        aria-hidden="false"
        className="pointer-events-none absolute inset-0 z-[5] overflow-visible"
        data-testid="fermentation-overlay"
      >
        {detail.keywords.slice(0, 5).map((kw, i) => {
          const pos =
            positions.keywords[kw.id] ??
            KEYWORD_FALLBACK_POSITIONS[i] ??
            KEYWORD_FALLBACK_POSITIONS[0];
          const microbe = MICROBE_TYPES[i % MICROBE_TYPES.length];
          return (
            <FloatingElement
              key={kw.id}
              containerRef={containerRef}
              pos={pos}
              floatClass={FLOAT_CLASSES[i % FLOAT_CLASSES.length]}
              ariaLabel={t('aria_keyword', { keyword: kw.keyword })}
              onMove={(x, y) => updateKeyword(kw.id, x, y)}
              onEnd={(x, y) => updateKeyword(kw.id, x, y)}
              onClick={() =>
                openDetail('keyword', { keyword: kw.keyword, description: kw.description })
              }
            >
              <div
                style={{
                  position: 'relative',
                  background: 'linear-gradient(135deg, #E8D1B5, #D9B48F)',
                  color: 'var(--fg)',
                  fontFamily: "'Noto Serif JP', serif",
                  fontSize: '13px',
                  letterSpacing: '0.15em',
                  padding: '6px 16px',
                  borderRadius: '999px',
                  boxShadow: '0 4px 12px rgba(217,180,143,0.3)',
                  border: '1px solid rgba(255,255,255,0.5)',
                  whiteSpace: 'nowrap',
                }}
              >
                {kw.keyword}
                <span
                  className="pointer-events-none absolute -top-2.5 -right-3 block h-[18px] w-[18px] opacity-60"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: static constant SVG, no user input
                  dangerouslySetInnerHTML={{ __html: MICROBE_SVGS[microbe] }}
                />
              </div>
            </FloatingElement>
          );
        })}

        {detail.snippets.slice(0, 3).map((s, i) => {
          const pos =
            positions.snippets[s.id] ??
            SNIPPET_FALLBACK_POSITIONS[i] ??
            SNIPPET_FALLBACK_POSITIONS[0];
          const displayText =
            s.originalText.length > 60 ? `${s.originalText.substring(0, 60)}…` : s.originalText;
          return (
            <FloatingElement
              key={s.id}
              containerRef={containerRef}
              pos={pos}
              floatClass={FLOAT_CLASSES[(i + 1) % FLOAT_CLASSES.length]}
              ariaLabel={t('aria_snippet')}
              onMove={(x, y) => updateSnippet(s.id, x, y)}
              onEnd={(x, y) => updateSnippet(s.id, x, y)}
              onClick={() =>
                openDetail('snippet', {
                  originalText: s.originalText,
                  sourceDate: s.sourceDate,
                  selectionReason: s.selectionReason,
                })
              }
            >
              <div
                style={{
                  background: 'rgba(253,251,247,0.6)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.6)',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  maxWidth: '200px',
                  boxShadow: '0 4px 16px rgba(140,133,126,0.12)',
                  color: 'var(--fg)',
                  fontFamily: "'Noto Sans JP', sans-serif",
                  fontWeight: 500,
                  fontSize: '11px',
                  lineHeight: 1.6,
                }}
              >
                {displayText}
              </div>
            </FloatingElement>
          );
        })}

        {detail.letter && (
          <FloatingElement
            containerRef={containerRef}
            pos={positions.letter ?? LETTER_FALLBACK_POSITION}
            floatClass={FLOAT_CLASSES[2]}
            ariaLabel={t('aria_letter')}
            onMove={(x, y) => updateLetter(x, y)}
            onEnd={(x, y) => updateLetter(x, y)}
            onClick={() =>
              openDetail('letter', { bodyText: detail.letter ? detail.letter.bodyText : '' })
            }
          >
            <div
              style={{
                background: 'rgba(247, 240, 230, 0.8)',
                border: '1px solid rgba(217, 180, 143, 0.5)',
                padding: '8px 14px',
                borderRadius: '4px',
                boxShadow: '0 4px 12px rgba(140, 133, 126, 0.12)',
                color: 'var(--fg)',
                fontFamily: "'Noto Serif JP', serif",
                fontSize: '12px',
                letterSpacing: '0.05em',
              }}
            >
              {t('letter_badge')}
            </div>
          </FloatingElement>
        )}
      </div>

      <FermentationOverlayDetailPane
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        type={detailType}
        data={detailData}
      />
    </>
  );
}
