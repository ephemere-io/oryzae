'use client';

import { useCallback, useRef, useState } from 'react';
import { DetailPane } from '@/features/fermentation/components/detail-pane';
import { QuestionCircle } from '@/features/fermentation/components/question-circle';
import { useFermentationForQuestion } from '@/features/fermentation/hooks/use-fermentation-results';
import type { ApiClient } from '@/lib/api';

interface QuestionData {
  id: string;
  currentText: string | null;
}

interface JarViewProps {
  api: ApiClient | null;
  authLoading: boolean;
  questions: QuestionData[];
  onAddQuestion?: (text: string) => Promise<void>;
  onEditQuestion?: (id: string, text: string) => Promise<void>;
  onArchiveQuestion?: (id: string) => Promise<void>;
}

const CIRCLE_POSITIONS = [
  { top: '22%', left: '80%' }, // top-right
  { top: '72%', left: '72%' }, // bottom center-right
  { top: '46%', left: '14%' }, // center-left
];

/* Text particles floating inside the jar */
const TEXT_PARTICLE_WORDS = ['発酵', '記憶', '静寂', '光', '闇', '朝', '麹', '息'];
const FILLER_WORDS = [
  '米',
  '水',
  '土壌',
  '醸す',
  '問い',
  '時間',
  '沈殿',
  '風',
  '季節',
  '菌',
  '熱',
  '繁殖',
  '心',
  '秋',
  '瀬',
];
const ALL_WORDS = [...TEXT_PARTICLE_WORDS, ...FILLER_WORDS];
const FLOAT_CLASSES = ['j2-float-1', 'j2-float-2', 'j2-float-3'];
const BLUR_LEVELS = [0.6, 0.8, 1.2, 1.8, 2.2, 2.5, 3.5, 4];
const FONT_SIZES = [11, 12, 14, 16, 18, 22, 26];

/* Microbe positions inside the jar */
const JAR_MICROBES: Array<{
  type: 'koji' | 'yeast' | 'lab';
  top: string;
  left: string;
  size: number;
  anim: string;
  opacity: number;
}> = [
  { type: 'koji', top: '32%', left: '55%', size: 32, anim: 'j2-float-2', opacity: 0.5 },
  { type: 'yeast', top: '52%', left: '22%', size: 24, anim: 'j2-float-3', opacity: 0.45 },
  { type: 'lab', top: '75%', left: '60%', size: 36, anim: 'j2-float-1', opacity: 0.4 },
  { type: 'koji', top: '15%', left: '68%', size: 28, anim: 'j2-float-2', opacity: 0.5 },
  { type: 'yeast', top: '45%', left: '78%', size: 24, anim: 'j2-float-1', opacity: 0.55 },
  { type: 'lab', top: '65%', left: '35%', size: 32, anim: 'j2-float-3', opacity: 0.4 },
];

/* Microbe SVG templates matching the reference design */
const MICROBE_SVGS = {
  koji: '<svg viewBox="0 0 28 28"><g fill="none"><path d="M14,24 C10,20 8,14 12,8 C14,6 16,6 18,8 C22,12 22,18 18,22" stroke="#A3B8A8" stroke-width="2" stroke-linecap="round" opacity="0.65"/><ellipse cx="14" cy="6" rx="3.5" ry="5" fill="#A3B8A8" opacity="0.35"/><ellipse cx="9" cy="10" rx="2" ry="3" fill="#8EA89C" opacity="0.45"/><ellipse cx="19" cy="14" rx="1.5" ry="2.5" fill="#8EA89C" opacity="0.3"/></g></svg>',
  yeast:
    '<svg viewBox="0 0 24 36"><g fill="#D9B48F" opacity="0.55"><rect x="8" y="4" width="8" height="20" rx="4" fill="#D9B48F" opacity="0.6"/><rect x="6" y="2" width="5" height="14" rx="2.5" fill="#E2C28E" opacity="0.7"/><rect x="14" y="8" width="4" height="12" rx="2" fill="#D9B48F" opacity="0.45"/><rect x="10" y="20" width="4" height="10" rx="2" fill="#E2C28E" opacity="0.5"/></g></svg>',
  lab: '<svg viewBox="0 0 32 20"><g fill="none"><path d="M6,14 Q12,6 18,12 Q26,18 30,10" stroke="#A3B8A8" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/><circle cx="6" cy="14" r="3" fill="#A3B8A8" opacity="0.4"/><circle cx="18" cy="12" r="2.5" fill="#8EA89C" opacity="0.35"/><circle cx="30" cy="10" r="2" fill="#A3B8A8" opacity="0.3"/></g></svg>',
};

/* Jar bottle SVG path (reference design) */
const JAR_PATH =
  'M190,100 C190,60 290,60 290,100 C290,130 270,140 270,170 C270,270 410,330 410,480 C410,580 70,580 70,480 C70,330 210,270 210,170 C210,140 190,130 190,100 Z';

function QuestionCircleWithData({
  question,
  api,
  position,
  zoomedId,
  onZoom,
  onElementClick,
}: {
  question: QuestionData;
  api: ApiClient | null;
  position: { top: string; left: string };
  zoomedId: string | null;
  onZoom: (id: string | null) => void;
  onElementClick: (
    questionText: string,
    type: 'keyword' | 'snippet' | 'letter',
    data: Record<string, string>,
  ) => void;
}) {
  const { detail } = useFermentationForQuestion(api, question.id);
  const isZoomed = zoomedId === question.id;
  const isHidden = zoomedId !== null && !isZoomed;

  return (
    <QuestionCircle
      questionId={question.id}
      questionText={question.currentText ?? ''}
      detail={detail}
      zoomed={isZoomed}
      hidden={isHidden}
      onClick={() => onZoom(question.id)}
      onElementClick={(type, data) => onElementClick(question.currentText ?? '', type, data)}
      style={
        isZoomed
          ? {}
          : {
              top: position.top,
              left: position.left,
            }
      }
    />
  );
}

export function JarView({
  api,
  authLoading,
  questions,
  onAddQuestion,
  onEditQuestion,
  onArchiveQuestion,
}: JarViewProps) {
  const [zoomedId, setZoomedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailType, setDetailType] = useState<'keyword' | 'snippet' | 'letter' | null>(null);
  const [detailData, setDetailData] = useState<Record<string, string> | null>(null);
  const [detailQuestion, setDetailQuestion] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const addInputRef = useRef<HTMLTextAreaElement>(null);
  const [editingQuestion, setEditingQuestion] = useState<QuestionData | null>(null);
  const [editText, setEditText] = useState('');
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleElementClick = useCallback(
    (
      questionText: string,
      type: 'keyword' | 'snippet' | 'letter',
      data: Record<string, string>,
    ) => {
      setDetailQuestion(questionText);
      setDetailType(type);
      setDetailData(data);
      setDetailOpen(true);
    },
    [],
  );

  function closeZoom() {
    setDetailOpen(false);
    setZoomedId(null);
  }

  if (authLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--date-color)]">
        読み込み中...
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-[var(--bg)]">
      {/* Keyframes */}
      <style>{`
        @keyframes j2-float-1 {
          0%, 100% { transform: translateY(0) translateX(0); }
          33% { transform: translateY(-10px) translateX(5px); }
          66% { transform: translateY(5px) translateX(-5px); }
        }
        @keyframes j2-float-2 {
          0%, 100% { transform: translateY(0) translateX(0); }
          33% { transform: translateY(5px) translateX(-8px); }
          66% { transform: translateY(-8px) translateX(3px); }
        }
        @keyframes j2-float-3 {
          0%, 100% { transform: translateY(0) translateX(0); }
          33% { transform: translateY(-6px) translateX(-4px); }
          66% { transform: translateY(8px) translateX(6px); }
        }
        .j2-float-1 { animation: j2-float-1 8s ease-in-out infinite; }
        .j2-float-2 { animation: j2-float-2 12s ease-in-out infinite; }
        .j2-float-3 { animation: j2-float-3 10s ease-in-out infinite 2s; }

        @keyframes j2-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes j2-flow {
          0% { stroke-dashoffset: 1000; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      {/* Background grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(140,133,126,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(140,133,126,0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          backgroundPosition: 'center center',
        }}
      />
      {/* Background radial */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(circle at 50% 40%, rgba(255,255,255,0.7) 0%, transparent 70%)',
        }}
      />

      {/* Zoom backdrop */}
      {zoomedId && (
        <button
          type="button"
          onClick={closeZoom}
          className="absolute inset-0 z-[4] bg-[rgba(0,0,0,0.3)]"
          aria-label="ズームを閉じる"
        />
      )}

      {/* Connection lines — using percentage-based SVG */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
        viewBox="0 0 1000 500"
        preserveAspectRatio="none"
        style={{
          opacity: zoomedId ? 0 : 1,
          transition: 'opacity 0.5s ease',
          animation: 'fadeIn 0.5s ease-out forwards',
        }}
      >
        {questions.slice(0, 3).map((q, i) => {
          const pos = CIRCLE_POSITIONS[i];
          const endX = (Number.parseFloat(pos.left) / 100) * 1000;
          const endY = (Number.parseFloat(pos.top) / 100) * 500;
          const jarX = 500;
          const jarY = 210;
          const cpX = (jarX + endX) / 2 + (i === 0 ? 50 : i === 1 ? 25 : -50);
          const cpY = (jarY + endY) / 2 + (i === 0 ? -30 : i === 1 ? 30 : 0);
          return (
            <g key={q.id}>
              {/* Glow layer */}
              <path
                d={`M ${jarX} ${jarY} Q ${cpX} ${cpY} ${endX} ${endY}`}
                stroke="rgba(142,168,156,0.08)"
                strokeWidth="4"
                fill="none"
                filter="url(#lineBlur)"
              />
              {/* Dashed line */}
              <path
                d={`M ${jarX} ${jarY} Q ${cpX} ${cpY} ${endX} ${endY}`}
                stroke="rgba(142,168,156,0.25)"
                strokeWidth="1"
                strokeDasharray="6 4"
                fill="none"
                style={{ animation: 'j2-flow 60s linear infinite' }}
              />
            </g>
          );
        })}
        <defs>
          <filter id="lineBlur">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
          </filter>
        </defs>
      </svg>

      {/* Central jar illustration — matching reference design */}
      <div
        className="pointer-events-none absolute z-[2]"
        style={{
          left: '50%',
          top: '45%',
          transform: 'translate(-50%, -55%)',
          width: '420px',
          height: '520px',
          animation: 'fadeIn 0.5s ease-out forwards',
        }}
      >
        {/* Jar glow */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(226,194,142,0.1)',
            borderRadius: '200px',
            filter: 'blur(80px)',
            animation: 'j2-pulse 4s cubic-bezier(0.4,0,0.6,1) infinite',
          }}
        />

        {/* Jar SVG */}
        <svg
          aria-hidden="true"
          className="h-full w-full"
          viewBox="0 0 480 600"
          fill="none"
          style={{ filter: 'drop-shadow(0 20px 40px rgba(140,133,126,0.15))' }}
        >
          {/* Glass body */}
          <path
            d={JAR_PATH}
            fill="rgba(253,251,247,0.2)"
            stroke="rgba(255,255,255,0.8)"
            strokeWidth="1.5"
          />
          {/* Fermentation liquid */}
          <path
            d="M78,450 C78,350 180,310 200,240 C220,240 270,310 402,450 C410,580 70,580 78,450 Z"
            fill="url(#j2-fermentGradient)"
            opacity="0.6"
            filter="url(#blurLiquid)"
          />
          {/* Highlight stroke (left) */}
          <path
            d="M100,460 C100,340 220,270 220,180"
            stroke="url(#j2-highlightGradient)"
            strokeWidth="4"
            strokeLinecap="round"
            filter="url(#blurHighlight)"
            opacity="0.7"
          />
          {/* Glass reflection (right) */}
          <path
            d="M380,480 C380,380 260,280 260,190"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="2"
            strokeLinecap="round"
            filter="url(#blurReflection)"
          />
          {/* Rim highlight */}
          <path
            d="M210,100 Q 240,110 270,100"
            stroke="rgba(255,255,255,0.9)"
            strokeWidth="3"
            strokeLinecap="round"
            filter="url(#blurReflection)"
          />
          {/* Interior flowing curves */}
          <g stroke="rgba(226,194,142,0.4)" strokeWidth="0.75" fill="none" opacity="0.8">
            <path d="M240,280 Q 280,350 250,420 T 320,520" className="j2-float-1" />
            <path d="M320,320 Q 290,380 340,440 T 260,540" className="j2-float-2" />
            <path d="M200,220 Q 240,290 180,350 T 210,480" className="j2-float-3" />
            <path d="M160,360 Q 140,420 200,460 T 140,530" className="j2-float-1" />
            <path d="M260,200 Q 270,250 240,290" />
          </g>
          <defs>
            <linearGradient id="j2-fermentGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(226,194,142,0.1)" />
              <stop offset="50%" stopColor="rgba(142,168,156,0.2)" />
              <stop offset="100%" stopColor="rgba(226,194,142,0.4)" />
            </linearGradient>
            <linearGradient id="j2-highlightGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
            <filter id="blurLiquid">
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
            </filter>
            <filter id="blurHighlight">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1" />
            </filter>
            <filter id="blurReflection">
              <feGaussianBlur in="SourceGraphic" stdDeviation="0.5" />
            </filter>
          </defs>
        </svg>

        {/* Text particles + microbes clipped inside jar */}
        <div
          className="pointer-events-auto absolute inset-0 overflow-hidden"
          style={{
            clipPath: `path('${JAR_PATH}')`,
          }}
        >
          {ALL_WORDS.map((word, i) => {
            const top = 18 + ((i * 37) % 65);
            const left = 22 + ((i * 53) % 60);
            const blur = BLUR_LEVELS[i % BLUR_LEVELS.length];
            const fontSize = FONT_SIZES[i % FONT_SIZES.length];
            const opacity = 0.3 + (i % 5) * 0.12;
            return (
              <span
                key={word}
                className={`${FLOAT_CLASSES[i % 3]} pointer-events-none select-none`}
                style={{
                  position: 'absolute',
                  top: `${top}%`,
                  left: `${left}%`,
                  filter: `blur(${blur}px)`,
                  fontSize: `${fontSize}px`,
                  opacity,
                  letterSpacing: '0.15em',
                  fontFamily: "'Noto Serif JP', serif",
                  color: 'var(--date-color)',
                }}
              >
                {word}
              </span>
            );
          })}
          {JAR_MICROBES.map((m, i) => (
            <div
              key={`microbe-${m.type}-${m.top}-${m.left}`}
              className={m.anim}
              style={{
                position: 'absolute',
                top: m.top,
                left: m.left,
                width: `${m.size}px`,
                height: `${m.size}px`,
                opacity: m.opacity,
                pointerEvents: 'none',
              }}
              // biome-ignore lint/security/noDangerouslySetInnerHtml: static constant SVG
              dangerouslySetInnerHTML={{ __html: MICROBE_SVGS[m.type] }}
            />
          ))}
        </div>
      </div>

      {/* Question circles */}
      {questions.slice(0, 3).map((q, i) => {
        const pos = CIRCLE_POSITIONS[i];
        return (
          <QuestionCircleWithData
            key={q.id}
            question={q}
            api={api}
            position={{ top: pos.top, left: pos.left }}
            zoomedId={zoomedId}
            onZoom={setZoomedId}
            onElementClick={handleElementClick}
          />
        );
      })}

      {/* Question list (bottom center) */}
      {!zoomedId && (
        <div
          className="absolute bottom-12 left-1/2 z-[30] flex -translate-x-1/2 flex-col items-center gap-2.5"
          style={{ animation: 'fadeIn 0.5s ease-out forwards' }}
        >
          <div
            className="h-6 w-px"
            style={{
              background: 'linear-gradient(to top, rgba(140,133,126,0.3), transparent)',
            }}
          />
          <span
            className="text-[10px] tracking-[0.3em] text-[var(--date-color)]"
            style={{ fontFamily: "'Noto Sans JP', sans-serif" }}
          >
            現在の問い
          </span>
          <div className="flex flex-wrap justify-center gap-2.5">
            {questions.slice(0, 3).map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => {
                  setEditingQuestion(q);
                  setEditText(q.currentText ?? '');
                  setTimeout(() => editInputRef.current?.focus(), 100);
                }}
                className="rounded-full px-4 py-1.5 text-[11px] font-medium tracking-[0.08em] transition-all hover:-translate-y-0.5"
                style={{
                  background: 'linear-gradient(135deg, var(--fg), rgba(140,133,126,0.9))',
                  color: 'var(--bg)',
                  fontFamily: "'Noto Serif JP', serif",
                  border: '1px solid rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(8px)',
                  boxShadow: '0 2px 8px rgba(74,69,65,0.15)',
                }}
              >
                {q.currentText}
              </button>
            ))}
          </div>
          {questions.length < 3 && onAddQuestion && (
            <button
              type="button"
              onClick={() => {
                setShowAddModal(true);
                setTimeout(() => addInputRef.current?.focus(), 100);
              }}
              className="rounded-full border border-dashed border-[var(--date-color)] px-3 py-1 text-[10px] tracking-[0.1em] text-[var(--date-color)] transition-all hover:bg-[rgba(140,133,126,0.1)]"
              style={{ fontFamily: "'Noto Sans JP', sans-serif" }}
            >
              ＋ 問いを追加する
            </button>
          )}
        </div>
      )}

      {/* Edit question modal */}
      {editingQuestion && (
        <div
          className="absolute inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.4)', animation: 'fadeIn 0.3s' }}
        >
          <div
            role="dialog"
            className="w-[380px] max-w-[90%] rounded-2xl bg-[var(--bg)] p-7 shadow-[0_20px_50px_rgba(0,0,0,0.15)]"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <h3
              className="mb-4 text-sm text-[var(--fg)]"
              style={{ fontFamily: "'Noto Serif JP', serif" }}
            >
              問いを編集
            </h3>
            <textarea
              ref={editInputRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              maxLength={64}
              rows={3}
              className="w-full resize-none rounded-lg border border-[var(--border-subtle)] bg-transparent p-3 text-[13px] text-[var(--fg)] outline-none"
              style={{ fontFamily: "'Noto Serif JP', serif" }}
            />
            <div className="mt-1 text-right text-[10px] text-[var(--date-color)]">
              {editText.length}/64
            </div>
            <div className="mt-3 flex justify-end gap-2.5">
              {onArchiveQuestion && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={async () => {
                    setSubmitting(true);
                    await onArchiveQuestion(editingQuestion.id);
                    setSubmitting(false);
                    setEditingQuestion(null);
                  }}
                  className="mr-auto rounded-full border border-[#dc2626] bg-transparent px-5 py-2 text-[11px] text-[#dc2626] transition-all hover:bg-[#dc2626] hover:text-white disabled:opacity-50"
                  style={{ fontFamily: "'Noto Sans JP', sans-serif" }}
                >
                  {submitting ? '処理中...' : 'アーカイブ'}
                </button>
              )}
              <button
                type="button"
                disabled={submitting}
                onClick={() => setEditingQuestion(null)}
                className="rounded-full border border-[var(--border-subtle)] bg-transparent px-5 py-2 text-[11px] text-[var(--date-color)] transition-all hover:bg-[rgba(140,133,126,0.1)] disabled:opacity-50"
                style={{ fontFamily: "'Noto Sans JP', sans-serif" }}
              >
                キャンセル
              </button>
              {onEditQuestion && (
                <button
                  type="button"
                  disabled={submitting || !editText.trim()}
                  onClick={async () => {
                    if (!editText.trim()) return;
                    setSubmitting(true);
                    await onEditQuestion(editingQuestion.id, editText.trim());
                    setSubmitting(false);
                    setEditingQuestion(null);
                  }}
                  className="rounded-full bg-[var(--fg)] px-5 py-2 text-[11px] text-[var(--bg)] transition-opacity hover:opacity-85 disabled:opacity-50"
                  style={{ fontFamily: "'Noto Sans JP', sans-serif" }}
                >
                  {submitting ? '更新中...' : '更新する'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add question modal */}
      {showAddModal && (
        <div
          className="absolute inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.4)', animation: 'fadeIn 0.3s' }}
        >
          <div
            role="dialog"
            className="w-[380px] max-w-[90%] rounded-2xl bg-[var(--bg)] p-7 shadow-[0_20px_50px_rgba(0,0,0,0.15)]"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <h3
              className="mb-4 text-sm text-[var(--fg)]"
              style={{ fontFamily: "'Noto Serif JP', serif" }}
            >
              新しい問いを追加
            </h3>
            <textarea
              ref={addInputRef}
              value={newQuestionText}
              onChange={(e) => setNewQuestionText(e.target.value)}
              placeholder="あなたの問いを入力してください"
              rows={3}
              className="w-full resize-none rounded-lg border border-[var(--border-subtle)] bg-transparent p-3 text-[13px] text-[var(--fg)] outline-none"
              style={{ fontFamily: "'Noto Serif JP', serif" }}
            />
            <div className="mt-4 flex justify-end gap-2.5">
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setShowAddModal(false);
                  setNewQuestionText('');
                }}
                className="rounded-full border border-[var(--border-subtle)] bg-transparent px-5 py-2 text-[11px] text-[var(--date-color)] transition-all hover:bg-[rgba(140,133,126,0.1)] disabled:opacity-50"
                style={{ fontFamily: "'Noto Sans JP', sans-serif" }}
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={submitting || !newQuestionText.trim()}
                onClick={async () => {
                  if (!newQuestionText.trim() || !onAddQuestion) return;
                  setSubmitting(true);
                  await onAddQuestion(newQuestionText.trim());
                  setSubmitting(false);
                  setNewQuestionText('');
                  setShowAddModal(false);
                }}
                className="rounded-full bg-[var(--fg)] px-5 py-2 text-[11px] text-[var(--bg)] transition-opacity hover:opacity-85 disabled:opacity-50"
                style={{ fontFamily: "'Noto Sans JP', sans-serif" }}
              >
                {submitting ? '追加中...' : '追加する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail pane */}
      <DetailPane
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        questionText={detailQuestion}
        type={detailType}
        data={detailData}
      />
    </div>
  );
}
