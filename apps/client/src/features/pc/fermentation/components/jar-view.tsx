'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CanvasGrid } from '@/components/ui/canvas-grid';
import { CanvasMinimap } from '@/components/ui/canvas-minimap';
import { CanvasViewport } from '@/components/ui/canvas-viewport';
import { CanvasZoomControls } from '@/components/ui/canvas-zoom-controls';
import { DetailPane } from '@/features/pc/fermentation/components/detail-pane';
import { JarVessel } from '@/features/pc/fermentation/components/jar-vessel';
import {
  QUESTION_CIRCLE_SIZE,
  QuestionCircle,
} from '@/features/pc/fermentation/components/question-circle';
import { useJarDrag } from '@/features/pc/fermentation/hooks/use-jar-drag';
import { useFermentationForQuestion } from '@/features/shared/fermentation/hooks/use-fermentation-for-question';
import { useJarLayoutSave } from '@/features/shared/fermentation/hooks/use-jar-layout-save';
import type { JarLayout } from '@/features/shared/fermentation/types';
import type { ApiClient } from '@/lib/api';
import { useCanvasViewport } from '@/lib/canvas/use-canvas-viewport';
import type { Bounds } from '@/lib/canvas/viewport';
import { useUnread } from '@/lib/unread-context';

/**
 * 瓶の「世界」の大きさ（world 単位）。
 *
 * ボードと違い瓶は **有限の世界** なので、寸法を固定して原点を持たせる。こうすると
 * DB に入っている 0–100 の座標が「ビューポートの %」ではなく「この箱の %」になり、
 * 数値の意味は変わらないままパン・ズームに乗る（マイグレーション不要。
 * `jarPositionItemSchema` の min(0).max(100) もそのまま成立する）。
 */
// 円を 280→700 に広げたぶん、世界も同じ比率で広げる。世界を据え置くと
// 既定配置の円どうしが重なる（3つの中心間距離が最短 516px しかなく、直径 700 を下回る）。
// 座標は % で持っているので、比率を保つ限り既存の配置は崩れない。
const JAR_WORLD_WIDTH = 2300;
const JAR_WORLD_HEIGHT = 1440;
const JAR_WORLD_BOUNDS: Bounds = {
  x: 0,
  y: 0,
  width: JAR_WORLD_WIDTH,
  height: JAR_WORLD_HEIGHT,
};

/** 円へズームする矩形の計算に使う。実体は QuestionCircle 側の定数（二重管理しない）。 */
const CIRCLE_SIZE = QUESTION_CIRCLE_SIZE;

/** 円の world 矩形。中心が (jarX%, jarY%) で translate(-50%,-50%) されている前提。 */
function circleWorldBounds(pos: Pos): Bounds {
  const centerX = (pos.jarX / 100) * JAR_WORLD_WIDTH;
  const centerY = (pos.jarY / 100) * JAR_WORLD_HEIGHT;
  return {
    x: centerX - CIRCLE_SIZE / 2,
    y: centerY - CIRCLE_SIZE / 2,
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
  };
}

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
  selectedElementId,
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
    id: string,
    data: Record<string, string>,
  ) => void;
  selectedElementId: string | null;
  onCircleMove: (id: string, pos: Pos) => void;
  onCircleDragEnd: (id: string, pos: Pos) => void;
  onInnerMove: (type: 'keyword' | 'snippet' | 'letter', id: string, pos: Pos) => void;
  onInnerDragEnd: (type: 'keyword' | 'snippet' | 'letter', id: string, pos: Pos) => void;
}) {
  const { detail } = useFermentationForQuestion(api, question.id);
  const isZoomed = zoomedId === question.id;
  // 開いている円以外は薄くするだけ（以前は opacity:0 で完全に消していた）。
  // カメラで寄る方式では周りの世界が見えていた方が現在地が分かる。
  const isDimmed = zoomedId !== null && !isZoomed;

  // 円のドラッグ移動。どれかを開いている間は無効（開いた円の中身の操作を優先する）。
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
      dimmed={isDimmed}
      innerOverrides={innerOverrides}
      selectedElementId={selectedElementId}
      onElementClick={(type, id, data) =>
        onElementClick(question.id, question.currentText ?? '', type, id, data)
      }
      onInnerDragMove={(type, id, x, y) => onInnerMove(type, id, { jarX: x, jarY: y })}
      onInnerDragEnd={(type, id, x, y) => onInnerDragEnd(type, id, { jarX: x, jarY: y })}
      circlePointerHandlers={pointerHandlers}
      onActivate={() => onZoom(question.id)}
      isDraggingCircle={isDragging}
      // 開いていても位置は変えない（拡大はカメラが担当する）。
      style={{ top: `${position.jarY}%`, left: `${position.jarX}%` }}
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
  // サイドバーに出している要素。円の中でも同じものに印を付けるために持つ。
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [detailQuestion, setDetailQuestion] = useState('');
  const [detailQuestionId, setDetailQuestionId] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const addInputRef = useRef<HTMLTextAreaElement>(null);
  const [editingQuestion, setEditingQuestion] = useState<QuestionData | null>(null);
  const [editText, setEditText] = useState('');
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const [submitting, setSubmitting] = useState(false);

  // world ボックス（JAR_WORLD_WIDTH × JAR_WORLD_HEIGHT）に付ける ref。
  // useJarDrag はこの要素の getBoundingClientRect() でポインタ px を % に直す。
  // rect は **変形後** の寸法（= world サイズ × 倍率）を返すので、ズームしていても
  // `dx / rect.width * 100` がそのまま正しい % になる（hook 側に倍率は要らない）。
  const jarContainerRef = useRef<HTMLDivElement | null>(null);

  // ショートカット（Shift+1/2）から最新の円の位置を読むための箱。
  const circleBoundsRef = useRef<{ all: Bounds; focused: Bounds | null }>({
    all: JAR_WORLD_BOUNDS,
    focused: null,
  });

  // 初回（保存された視点が無いとき）は世界全体が収まる倍率で開く。
  // 一度でも動かせば保存値が優先されるので、続きから開いた人の視点は壊さない。
  const canvas = useCanvasViewport({
    storageKey: 'jar',
    defaultFitBounds: JAR_WORLD_BOUNDS,
    // 瓶は世界の大きさが決まっているので「全体表示」は常に世界そのもの。
    getContentBounds: () => circleBoundsRef.current.all,
    getSelectionBounds: () => circleBoundsRef.current.focused,
  });
  const { zoomIn, zoomOut, resetZoom, fitTo } = canvas;

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
      id: string,
      data: Record<string, string>,
    ) => {
      setDetailQuestionId(questionId);
      setDetailQuestion(questionText);
      setDetailType(type);
      setDetailData(data);
      setSelectedElementId(id);
      setDetailOpen(true);
    },
    [],
  );

  if (authLoading) return null;

  const visibleQuestions = questions.slice(0, 3);
  const resolvedCirclePositions = visibleQuestions.map((q, i) =>
    resolveCirclePos({ question: q, index: i, override: overrides.questions[q.id] }),
  );

  /**
   * 背景クリックで選択を解除する。以前は円の背後に敷いた backdrop がこの役目だったが、
   * 円を画面中央へ飛ばすのをやめたので backdrop 自体が不要になった。
   * 何も開いていないときは無反応にする（ただの背景クリックで勝手に引かないように）。
   */
  circleBoundsRef.current = {
    all: JAR_WORLD_BOUNDS,
    focused: (() => {
      const index = visibleQuestions.findIndex((q) => q.id === zoomedId);
      return index >= 0 ? circleWorldBounds(resolvedCirclePositions[index]) : null;
    })(),
  };

  function closeZoom() {
    if (!zoomedId) return;
    setDetailOpen(false);
    setZoomedId(null);
    // 位置は動かさず、カメラだけ引いて世界全体に戻す。
    fitTo(JAR_WORLD_BOUNDS);
  }

  /**
   * 円の選択。**円は動かさずカメラを寄せる**（Figma と同じ挙動）。
   *
   * 以前は選択した円を position:fixed で画面中央へ飛ばし、他の円を opacity:0 で隠し、
   * 背後に backdrop を敷いていた。transform で変形した祖先の中では fixed が
   * 画面基準にならないため、本物のズームを入れるならどのみち成立しない作りだった。
   * いまは `fitTo` で円の world 矩形に寄るだけなので、隠す・飛ばすが全部不要になる。
   * `zoomedId` は「どの円を開いているか」という意味だけを持つ（中身の操作可否・拡大率）。
   */
  function focusCircle(id: string | null) {
    setZoomedId(id);
    if (id === null) {
      fitTo(JAR_WORLD_BOUNDS);
      return;
    }
    const index = visibleQuestions.findIndex((q) => q.id === id);
    if (index >= 0) fitTo(circleWorldBounds(resolvedCirclePositions[index]));
  }

  function handleFit() {
    setZoomedId(null);
    fitTo(JAR_WORLD_BOUNDS);
  }

  const addAvailable = !zoomedId && questions.length < 3 && Boolean(onAddQuestion);

  return (
    <div
      {...verifyAttrs({
        unit: 'JarView',
        questionCount: visibleQuestions.length,
        zoomed: zoomedId !== null,
        editOpen: editingQuestion !== null,
        addOpen: showAddModal,
        addAvailable,
        percent: Math.round(canvas.viewport.scale * 100),
      })}
      className="relative h-full w-full bg-[var(--bg)]"
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

      <CanvasViewport
        canvas={canvas}
        ariaLabel={t('jar.canvas_aria')}
        onClick={closeZoom}
        // 方眼は frame（スクリーン空間）に敷く。world ボックスの内側に置くと
        // ボックスの外へパン・ズームしたときに背景が途切れる。
        background={<CanvasGrid canvas={canvas} color="rgba(140,133,126,0.07)" />}
        overlay={
          // 操作 UI の上ではパンを始めない。
          <div data-canvas-no-pan="">
            <CanvasZoomControls
              scale={canvas.viewport.scale}
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
              onReset={resetZoom}
              onFit={handleFit}
            />
            <CanvasMinimap
              canvas={canvas}
              ariaLabel={t('jar.minimap_aria')}
              extent={JAR_WORLD_BOUNDS}
              items={visibleQuestions.map((q, i) => ({
                id: q.id,
                ...circleWorldBounds(resolvedCirclePositions[i]),
              }))}
            />
          </div>
        }
      >
        {/* world ボックス。中の要素は今までどおり % 指定のままでよく、その % が
            「ビューポート基準」から「この箱基準」に読み替わるだけ。 */}
        <div
          ref={jarContainerRef}
          // overflow は付けない。world の縁ぎりぎりに置かれた円（jarX=100 等）が
          // 半分だけ切り取られてしまうため。frame 側が画面外を隠す。
          className="absolute left-0 top-0"
          style={{ width: JAR_WORLD_WIDTH, height: JAR_WORLD_HEIGHT }}
        >
          {/* Background radial */}
          <div
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              // closest-side にして、白が透明になりきる前に箱の縁へ達しないようにする。
              // 既定の farthest-corner だと半径が箱の高さ半分を超え、上下の縁で
              // グラデーションが途中のまま断ち切られて四角い境目が見えていた。
              background:
                'radial-gradient(circle closest-side at 50% 42%, rgba(255,255,255,0.7) 0%, transparent 100%)',
            }}
          />

          {/* Connection lines.
          viewBox は world ボックスと 1:1。以前は 1000×500 の viewBox を
          preserveAspectRatio="none" で引き伸ばしていたため、縦横で倍率が違い
          曲線が歪んでいた（ズームすると露骨に出る）。等方にして歪みを消す。 */}
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
            viewBox={`0 0 ${JAR_WORLD_WIDTH} ${JAR_WORLD_HEIGHT}`}
            style={{
              opacity: zoomedId ? 0 : 1,
              transition: 'opacity 0.5s ease',
              animation: 'fadeIn 0.5s ease-out forwards',
            }}
          >
            {visibleQuestions.map((q, i) => {
              const pos = resolvedCirclePositions[i];
              const endX = (pos.jarX / 100) * JAR_WORLD_WIDTH;
              const endY = (pos.jarY / 100) * JAR_WORLD_HEIGHT;
              // 瓶の中ほど（世界の中央やや上）から線が伸びる。
              const jarX = JAR_WORLD_WIDTH / 2;
              const jarY = JAR_WORLD_HEIGHT * 0.42;
              const cpX = (jarX + endX) / 2 + (i === 0 ? 80 : i === 1 ? 40 : -80);
              const cpY = (jarY + endY) / 2 + (i === 0 ? -60 : i === 1 ? 60 : 0);
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

          {/* 瓶本体。見た目は readiness に追従する（issue #278）。
              #533 で world ボックスに合わせて 420×520 → 500×620 に拡大している。 */}
          <JarVessel readiness={readiness} width={500} height={620} />

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
              onZoom={focusCircle}
              onElementClick={handleElementClick}
              selectedElementId={selectedElementId}
              onCircleMove={handleCircleMove}
              onCircleDragEnd={handleCircleDragEnd}
              onInnerMove={handleInnerDragMove}
              onInnerDragEnd={handleInnerDragEnd}
            />
          ))}
        </div>
      </CanvasViewport>

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
                // 検証スペックが「問いチップ」を一意に指すための取っ手。
                // 以前は最初の <button> を押していたが、ズームコントロールが
                // DOM 上で前に来たため壊れた（順序に依存しない選択子にする）。
                data-verify-part="question-chip"
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
        onClose={() => {
          setDetailOpen(false);
          setSelectedElementId(null);
        }}
        questionId={detailQuestionId}
        questionText={detailQuestion}
        type={detailType}
        data={detailData}
      />
    </div>
  );
}
