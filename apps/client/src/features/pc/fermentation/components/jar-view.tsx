'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DetailPane } from '@/features/pc/fermentation/components/detail-pane';
import { JarVessel } from '@/features/pc/fermentation/components/jar-vessel';
import { QuestionCircle } from '@/features/pc/fermentation/components/question-circle';
import { useJarDrag } from '@/features/pc/fermentation/hooks/use-jar-drag';
import { useFermentationForQuestion } from '@/features/shared/fermentation/hooks/use-fermentation-for-question';
import { useJarLayoutSave } from '@/features/shared/fermentation/hooks/use-jar-layout-save';
import type { JarLayout } from '@/features/shared/fermentation/types';
import type { ApiClient } from '@/lib/api';
import { useUnread } from '@/lib/unread-context';

interface QuestionData {
  id: string;
  currentText: string | null;
  /** Jar view position (0-100, percent of the JarView viewport). null → fall back. */
  jarX: number | null;
  jarY: number | null;
}

interface JarViewProps {
  api: ApiClient | null;
  authLoading: boolean;
  questions: QuestionData[];
  /**
   * 発酵瓶の readiness（issue #278）。問いごとの readiness の総和なので 0〜3。
   * 瓶の見た目だけがこれに追従する。数値としては一切表示しない。
   */
  readiness?: number;
  onAddQuestion?: (text: string) => Promise<void>;
  onEditQuestion?: (id: string, text: string) => Promise<void>;
  onArchiveQuestion?: (id: string) => Promise<void>;
}

/**
 * Fallback positions for the up-to-3 question circles, used when the user has never
 * dragged a circle and the DB has no jar_x/jar_y for that question. Coordinates are
 * percentages of the JarView container.
 */
const CIRCLE_FALLBACK_POSITIONS: Array<{ x: number; y: number }> = [
  { x: 80, y: 22 }, // top-right
  { x: 72, y: 72 }, // bottom center-right
  { x: 14, y: 46 }, // center-left
];

interface Pos {
  jarX: number;
  jarY: number;
}

interface JarLayoutOverrides {
  questions: Record<string, Pos>;
  keywords: Record<string, Pos>;
  snippets: Record<string, Pos>;
  letters: Record<string, Pos>;
}

const EMPTY_OVERRIDES: JarLayoutOverrides = {
  questions: {},
  keywords: {},
  snippets: {},
  letters: {},
};

function overridesToPayload(overrides: JarLayoutOverrides): JarLayout {
  return {
    questions: Object.entries(overrides.questions).map(([id, p]) => ({ id, ...p })),
    keywords: Object.entries(overrides.keywords).map(([id, p]) => ({ id, ...p })),
    snippets: Object.entries(overrides.snippets).map(([id, p]) => ({ id, ...p })),
    letters: Object.entries(overrides.letters).map(([id, p]) => ({ id, ...p })),
  };
}

interface CirclePosArgs {
  question: QuestionData;
  index: number;
  override: Pos | undefined;
}

function resolveCirclePos({ question, index, override }: CirclePosArgs): Pos {
  if (override) return override;
  if (question.jarX != null && question.jarY != null) {
    return { jarX: question.jarX, jarY: question.jarY };
  }
  const fallback = CIRCLE_FALLBACK_POSITIONS[index] ?? CIRCLE_FALLBACK_POSITIONS[0];
  return { jarX: fallback.x, jarY: fallback.y };
}

function QuestionCircleWithData({
  question,
  api,
  position,
  zoomedId,
  jarContainerRef,
  innerOverrides,
  onZoom,
  onElementClick,
  onCircleMove,
  onCircleDragEnd,
  onInnerMove,
  onInnerDragEnd,
}: {
  question: QuestionData;
  api: ApiClient | null;
  position: Pos;
  zoomedId: string | null;
  jarContainerRef: React.RefObject<HTMLElement | null>;
  innerOverrides: {
    keywords: Record<string, Pos>;
    snippets: Record<string, Pos>;
    letters: Record<string, Pos>;
  };
  onZoom: (id: string | null) => void;
  onElementClick: (
    questionId: string,
    questionText: string,
    type: 'keyword' | 'snippet' | 'letter',
    data: Record<string, string>,
  ) => void;
  onCircleMove: (id: string, pos: Pos) => void;
  onCircleDragEnd: (id: string, pos: Pos) => void;
  onInnerMove: (type: 'keyword' | 'snippet' | 'letter', id: string, pos: Pos) => void;
  onInnerDragEnd: (type: 'keyword' | 'snippet' | 'letter', id: string, pos: Pos) => void;
}) {
  const { detail } = useFermentationForQuestion(api, question.id);
  const isZoomed = zoomedId === question.id;
  const isHidden = zoomedId !== null && !isZoomed;

  // Drag the circle around the jar viewport. Disabled while *any* circle is zoomed —
  // including this one (the zoomed circle is fixed-positioned to the centre).
  const { isDragging, pointerHandlers } = useJarDrag({
    containerRef: jarContainerRef,
    enabled: zoomedId === null,
    x: position.jarX,
    y: position.jarY,
    onClickWithoutDrag: () => onZoom(question.id),
    onDragMove: (x, y) => onCircleMove(question.id, { jarX: x, jarY: y }),
    onDragEnd: (x, y) => onCircleDragEnd(question.id, { jarX: x, jarY: y }),
  });

  return (
    <QuestionCircle
      questionId={question.id}
      questionText={question.currentText ?? ''}
      detail={detail}
      zoomed={isZoomed}
      hidden={isHidden}
      innerOverrides={innerOverrides}
      onElementClick={(type, data) =>
        onElementClick(question.id, question.currentText ?? '', type, data)
      }
      onInnerDragMove={(type, id, x, y) => onInnerMove(type, id, { jarX: x, jarY: y })}
      onInnerDragEnd={(type, id, x, y) => onInnerDragEnd(type, id, { jarX: x, jarY: y })}
      circlePointerHandlers={pointerHandlers}
      onActivate={() => onZoom(question.id)}
      isDraggingCircle={isDragging}
      style={
        isZoomed
          ? {}
          : {
              top: `${position.jarY}%`,
              left: `${position.jarX}%`,
            }
      }
    />
  );
}

export function JarView({
  api,
  authLoading,
  questions,
  readiness = 0,
  onAddQuestion,
  onEditQuestion,
  onArchiveQuestion,
}: JarViewProps) {
  const t = useTranslations('fermentation');
  // Issue #447: 一括既読は PC の瓶だけ。盤面に手紙が全部並ぶので「開いた＝読んだ」。
  // SP の瓶は一覧なので、開いた手紙の問いを 1 つずつ SpJar が既読にする。
  const { markAllSeen } = useUnread();
  useEffect(() => {
    markAllSeen();
  }, [markAllSeen]);

  const [zoomedId, setZoomedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailType, setDetailType] = useState<'keyword' | 'snippet' | 'letter' | null>(null);
  const [detailData, setDetailData] = useState<Record<string, string> | null>(null);
  const [detailQuestion, setDetailQuestion] = useState('');
  const [detailQuestionId, setDetailQuestionId] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const addInputRef = useRef<HTMLTextAreaElement>(null);
  const [editingQuestion, setEditingQuestion] = useState<QuestionData | null>(null);
  const [editText, setEditText] = useState('');
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const [submitting, setSubmitting] = useState(false);

  // Ref attached to the JarView root — used by the circle drag to convert pointer pixels to %.
  const jarContainerRef = useRef<HTMLDivElement | null>(null);

  // Drag-state overrides layer over the API data: empty after page load, fills as the user drags.
  const [overrides, setOverrides] = useState<JarLayoutOverrides>(EMPTY_OVERRIDES);

  const { saveLayout } = useJarLayoutSave(api);

  const handleCircleMove = useCallback((id: string, pos: Pos) => {
    setOverrides((prev) => ({
      ...prev,
      questions: { ...prev.questions, [id]: pos },
    }));
  }, []);

  const handleCircleDragEnd = useCallback(
    (id: string, pos: Pos) => {
      setOverrides((prev) => {
        const next = {
          ...prev,
          questions: { ...prev.questions, [id]: pos },
        };
        saveLayout(overridesToPayload(next));
        return next;
      });
    },
    [saveLayout],
  );

  const handleInnerDragMove = useCallback(
    (type: 'keyword' | 'snippet' | 'letter', id: string, pos: Pos) => {
      setOverrides((prev) => ({
        ...prev,
        [`${type}s`]: { ...prev[`${type}s` as 'keywords' | 'snippets' | 'letters'], [id]: pos },
      }));
    },
    [],
  );

  const handleInnerDragEnd = useCallback(
    (type: 'keyword' | 'snippet' | 'letter', id: string, pos: Pos) => {
      setOverrides((prev) => {
        const next = {
          ...prev,
          [`${type}s`]: { ...prev[`${type}s` as 'keywords' | 'snippets' | 'letters'], [id]: pos },
        };
        saveLayout(overridesToPayload(next));
        return next;
      });
    },
    [saveLayout],
  );

  const handleElementClick = useCallback(
    (
      questionId: string,
      questionText: string,
      type: 'keyword' | 'snippet' | 'letter',
      data: Record<string, string>,
    ) => {
      setDetailQuestionId(questionId);
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

  if (authLoading) return null;

  const visibleQuestions = questions.slice(0, 3);
  const resolvedCirclePositions = visibleQuestions.map((q, i) =>
    resolveCirclePos({ question: q, index: i, override: overrides.questions[q.id] }),
  );

  const addAvailable = !zoomedId && questions.length < 3 && Boolean(onAddQuestion);

  return (
    <div
      ref={jarContainerRef}
      {...verifyAttrs({
        unit: 'JarView',
        questionCount: visibleQuestions.length,
        zoomed: zoomedId !== null,
        editOpen: editingQuestion !== null,
        addOpen: showAddModal,
        addAvailable,
      })}
      className="relative h-full w-full overflow-hidden bg-[var(--bg)]"
    >
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
          aria-label={t('jar.zoom_close_aria')}
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
        {visibleQuestions.map((q, i) => {
          const pos = resolvedCirclePositions[i];
          const endX = (pos.jarX / 100) * 1000;
          const endY = (pos.jarY / 100) * 500;
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

      {/* 瓶本体。見た目は readiness に追従する（issue #278）。 */}
      <JarVessel readiness={readiness} />

      {/* Question circles */}
      {visibleQuestions.map((q, i) => (
        <QuestionCircleWithData
          key={q.id}
          question={q}
          api={api}
          position={resolvedCirclePositions[i]}
          zoomedId={zoomedId}
          jarContainerRef={jarContainerRef}
          innerOverrides={{
            keywords: overrides.keywords,
            snippets: overrides.snippets,
            letters: overrides.letters,
          }}
          onZoom={setZoomedId}
          onElementClick={handleElementClick}
          onCircleMove={handleCircleMove}
          onCircleDragEnd={handleCircleDragEnd}
          onInnerMove={handleInnerDragMove}
          onInnerDragEnd={handleInnerDragEnd}
        />
      ))}

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
            {t('jar.current_questions')}
          </span>
          <div className="flex flex-wrap justify-center gap-2.5">
            {visibleQuestions.map((q) => (
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
          {addAvailable && (
            <button
              type="button"
              onClick={() => {
                setShowAddModal(true);
                setTimeout(() => addInputRef.current?.focus(), 100);
              }}
              className="rounded-full border border-dashed border-[var(--date-color)] px-3 py-1 text-[10px] tracking-[0.1em] text-[var(--date-color)] transition-all hover:bg-[rgba(140,133,126,0.1)]"
              style={{ fontFamily: "'Noto Sans JP', sans-serif" }}
            >
              {t('jar.add_question')}
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
              {t('jar.edit_heading')}
            </h3>
            <textarea
              ref={editInputRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              aria-label={t('jar.edit_heading')}
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
                  {submitting ? t('jar.processing') : t('jar.archive')}
                </button>
              )}
              <button
                type="button"
                disabled={submitting}
                onClick={() => setEditingQuestion(null)}
                className="rounded-full border border-[var(--border-subtle)] bg-transparent px-5 py-2 text-[11px] text-[var(--date-color)] transition-all hover:bg-[rgba(140,133,126,0.1)] disabled:opacity-50"
                style={{ fontFamily: "'Noto Sans JP', sans-serif" }}
              >
                {t('jar.cancel_edit')}
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
                  {submitting ? t('jar.updating') : t('jar.update')}
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
              {t('jar.add_heading')}
            </h3>
            <textarea
              ref={addInputRef}
              value={newQuestionText}
              onChange={(e) => setNewQuestionText(e.target.value)}
              aria-label={t('jar.add_heading')}
              placeholder={t('jar.add_placeholder')}
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
                {t('jar.cancel_add')}
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
                {submitting ? t('jar.adding') : t('jar.add_submit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail pane */}
      <DetailPane
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        questionId={detailQuestionId}
        questionText={detailQuestion}
        type={detailType}
        data={detailData}
      />
    </div>
  );
}
