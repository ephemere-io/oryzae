'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CanvasGrid } from '@/components/ui/canvas-grid';
import { CanvasMinimap } from '@/components/ui/canvas-minimap';
import { CanvasViewport } from '@/components/ui/canvas-viewport';
import { CanvasZoomControls } from '@/components/ui/canvas-zoom-controls';
import { DetailPane } from '@/features/pc/fermentation/components/detail-pane';
import { FermentationCoverFlow } from '@/features/pc/fermentation/components/fermentation-cover-flow';
import {
  QUESTION_CIRCLE_SIZE,
  QuestionCircle,
} from '@/features/pc/fermentation/components/question-circle';
import { useJarDrag } from '@/features/pc/fermentation/hooks/use-jar-drag';
import { pad2, toDateStamp } from '@/features/pc/fermentation/utils/history-labels';
import { useFermentationDetails } from '@/features/shared/fermentation/hooks/use-fermentation-details';
import { useFermentationForQuestion } from '@/features/shared/fermentation/hooks/use-fermentation-for-question';
import { useFermentationHistory } from '@/features/shared/fermentation/hooks/use-fermentation-history';
import { useJarLayoutSave } from '@/features/shared/fermentation/hooks/use-jar-layout-save';
import type { FermentationDetail, JarLayout } from '@/features/shared/fermentation/types';
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

/** メタラベル（発酵履歴への入口）を円の下端からどれだけ離すか（world 単位）。 */
const META_LABEL_GAP = 18;
/**
 * メタラベルの高さ（world 単位）。9px の 2 行＋行間＋上下パディングでおよそ 40。
 * 実測に合わせた概算だが、**円へ寄るときの画面に収める計算**にしか使わないので、
 * 多少大きめに見積もる方が安全（余白が増えるだけ）。
 */
const META_LABEL_HEIGHT = 40;

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

/**
 * 円へ寄るときに画面へ収める矩形。**円だけでなく下のメタラベルまで**含める。
 *
 * 円ぴったりに寄せると、`fitBounds` が円を画面中央に置くぶんラベルが下へはみ出し、
 * キャンバスの下端（＝フッターの直上）で切られて押せなくなる。ラベルは発酵履歴への
 * 唯一の入口なので、寄った状態でも必ず画面に残っていないといけない。
 */
function circleFocusBounds(pos: Pos): Bounds {
  const box = circleWorldBounds(pos);
  return { ...box, height: box.height + META_LABEL_GAP + META_LABEL_HEIGHT };
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

/* Translation keys for text particles floating inside the jar.
 * Order is significant — used as deterministic seed for layout (top/left/blur/etc.). */
const PARTICLE_WORD_KEYS = [
  'jar.particle_fermentation',
  'jar.particle_memory',
  'jar.particle_silence',
  'jar.particle_light',
  'jar.particle_dark',
  'jar.particle_morning',
  'jar.particle_koji',
  'jar.particle_breath',
] as const;
const FILLER_WORD_KEYS = [
  'jar.filler_rice',
  'jar.filler_water',
  'jar.filler_soil',
  'jar.filler_brew',
  'jar.filler_question',
  'jar.filler_time',
  'jar.filler_sediment',
  'jar.filler_wind',
  'jar.filler_season',
  'jar.filler_microbe',
  'jar.filler_heat',
  'jar.filler_propagate',
  'jar.filler_heart',
  'jar.filler_autumn',
  'jar.filler_shallows',
] as const;
const ALL_WORD_KEYS = [...PARTICLE_WORD_KEYS, ...FILLER_WORD_KEYS];
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

/**
 * 発酵履歴への入口に添えるアイコン。積み重なった円盤＝めくれる束。
 *
 * **塗りで描く**。この取っ手は world の中にあるので、俯瞰（全体表示）では 15px 前後まで
 * 縮む。線画の円を並べる案は実機で試したが、その大きさだと線が潰れて枠のリングと
 * 混ざり、ただのぼやけた輪になった。塗りの楕円なら小さくても「重なっている」が残る。
 *
 * 手前を濃く、奥へ薄くして「手前の 1 枚だけが開いている」Cover Flow の見え方と揃える。
 */
function HistoryStackIcon() {
  return (
    <svg viewBox="0 0 26 26" fill="none" aria-hidden="true" className="h-full w-full">
      <ellipse cx="13" cy="7.5" rx="8.5" ry="3.1" fill="currentColor" opacity="0.3" />
      <ellipse cx="13" cy="13" rx="8.5" ry="3.1" fill="currentColor" opacity="0.5" />
      <ellipse cx="13" cy="18.5" rx="8.5" ry="3.1" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

/* Jar bottle SVG path (reference design) */
const JAR_PATH =
  'M190,100 C190,60 290,60 290,100 C290,130 270,140 270,170 C270,270 410,330 410,480 C410,580 70,580 70,480 C70,330 210,270 210,170 C210,140 190,130 190,100 Z';

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
  onDetailLoaded,
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
  /** 取れた詳細を親へ上げる。瓶の中に流す言葉をここから作る。 */
  onDetailLoaded: (questionId: string, detail: FermentationDetail | null) => void;
}) {
  const { detail } = useFermentationForQuestion(api, question.id);

  useEffect(() => {
    onDetailLoaded(question.id, detail);
  }, [question.id, detail, onDetailLoaded]);
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
  onAddQuestion,
  onEditQuestion,
  onArchiveQuestion,
}: JarViewProps) {
  const t = useTranslations('fermentation');
  /**
   * 既読は「その問いの履歴を開いたとき」に進める（SP の瓶と同じ単位）。
   *
   * Issue #447 の時点では PC の瓶を開いた瞬間に全部を既読にしていた（`markAllSeen`）。
   * 「盤面に手紙が全部並ぶので開いた＝読んだ」が理由だったが、発酵履歴が入って前提が
   * 変わった。過去の発酵は Cover Flow の奥にあり、瓶を開いただけでは見えていない。
   * 一括既読を残すと、届いたばかりの手紙が読む前に既読になり、履歴の未読の印
   * （`· NEW`）も常に空になる。
   */
  const { markQuestionRead, unreadFermentationIds } = useUnread();

  const [zoomedId, setZoomedId] = useState<string | null>(null);
  /** 発酵履歴を開いている問い。null なら瓶のキャンバス。 */
  const [historyQuestionId, setHistoryQuestionId] = useState<string | null>(null);
  /** 問いごとに正面に出している段。未設定なら最新（末尾）。 */
  const [historyIndex, setHistoryIndex] = useState<Record<string, number>>({});
  /** 円が取ってきた最新の発酵詳細。瓶の中に流す言葉をここから作る。 */
  const [detailByQuestion, setDetailByQuestion] = useState<
    Record<string, FermentationDetail | null>
  >({});
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

  // 問いごとの完了済み発酵（古い順）。ユーザー全件を 1 回で取って束ねるので、
  // 円が 3 つでもリクエストは 1 本しか増えない。
  const { byQuestion } = useFermentationHistory(api, authLoading);

  const historyResults = useMemo(
    () => (historyQuestionId ? (byQuestion.get(historyQuestionId) ?? []) : []),
    [byQuestion, historyQuestionId],
  );

  // 未設定なら最新（末尾）を正面にして開く。
  const activeHistoryIndex =
    historyQuestionId === null
      ? 0
      : (historyIndex[historyQuestionId] ?? Math.max(0, historyResults.length - 1));

  // 本文が要るのは正面と左右 1 枚だけ。全件を先読みしない。
  const visibleResultIds = useMemo(
    () =>
      historyResults
        .slice(Math.max(0, activeHistoryIndex - 1), activeHistoryIndex + 2)
        .map((r) => r.id),
    [historyResults, activeHistoryIndex],
  );
  const { details: historyDetails } = useFermentationDetails(api, visibleResultIds);

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

  const fallbackWords = useMemo(() => ALL_WORD_KEYS.map((key) => t(key)), [t]);

  /**
   * 瓶の中に漂う言葉。
   *
   * 既定の英単語（発酵 / 記憶 / …）ではなく、**その人の発酵が生んだキーワード**を流す。
   * 瓶の中身が自分の言葉になることが、この画面のいちばん強い手応えになる。
   * まだ 1 件も発酵していない人には既定の語を出す（空の瓶にしない）。
   */
  const allWords = useMemo(() => {
    const keywords = Object.values(detailByQuestion)
      .flatMap((detail) => detail?.keywords ?? [])
      .map((k) => k.keyword)
      .filter((word) => word.length > 0);
    const unique = [...new Set(keywords)];
    return unique.length > 0 ? unique : fallbackWords;
  }, [detailByQuestion, fallbackWords]);

  const handleDetailLoaded = useCallback(
    (questionId: string, detail: FermentationDetail | null) => {
      setDetailByQuestion((prev) =>
        prev[questionId] === detail ? prev : { ...prev, [questionId]: detail },
      );
    },
    [],
  );

  /** 発酵履歴をひらく。ここを既読の単位にする（瓶を開いただけでは既読にしない）。 */
  const openHistory = useCallback(
    (questionId: string) => {
      setHistoryQuestionId(questionId);
      setDetailOpen(false);
      setSelectedElementId(null);
      markQuestionRead(questionId);
    },
    [markQuestionRead],
  );

  const closeHistory = useCallback(() => {
    setHistoryQuestionId(null);
    setDetailOpen(false);
    setSelectedElementId(null);
  }, []);

  /** 段を移動したら詳細パネルは閉じる（別の回の内容を出したままにしない）。 */
  const handleHistoryIndexChange = useCallback(
    (next: number) => {
      if (!historyQuestionId) return;
      setHistoryIndex((prev) => ({ ...prev, [historyQuestionId]: next }));
      setDetailOpen(false);
      setSelectedElementId(null);
    },
    [historyQuestionId],
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
      return index >= 0 ? circleFocusBounds(resolvedCirclePositions[index]) : null;
    })(),
  };

  function closeZoom() {
    // 履歴が開いている間はキャンバスに触れない（オーバーレイが上に乗っている）。
    if (historyQuestionId !== null) return;
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
    if (index >= 0) fitTo(circleFocusBounds(resolvedCirclePositions[index]));
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
        historyOpen: historyQuestionId !== null,
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

          {/* Central jar illustration — matching reference design */}
          <div
            className="pointer-events-none absolute z-[2]"
            style={{
              left: '50%',
              top: '45%',
              transform: 'translate(-50%, -55%)',
              width: '500px',
              height: '620px',
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
              {/* Glass body.
                  縁は元々 白 0.8 だったが、紙色（--bg #f9f8f4）の地の上ではほぼ消えて
                  瓶の形が読めなかった。輪郭を落として形が立つようにする。濃くしすぎると
                  絵が硬くなるので、0.3 / 1.2px に留める。 */}
              <path
                d={JAR_PATH}
                fill="rgba(226,194,142,0.05)"
                stroke="rgba(122,116,64,0.3)"
                strokeWidth="1.2"
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
              {allWords.map((word, i) => {
                const top = 18 + ((i * 37) % 65);
                const left = 22 + ((i * 53) % 60);
                const blur = BLUR_LEVELS[i % BLUR_LEVELS.length];
                const fontSize = FONT_SIZES[i % FONT_SIZES.length];
                const opacity = 0.3 + (i % 5) * 0.12;
                return (
                  <span
                    key={ALL_WORD_KEYS[i]}
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
              onDetailLoaded={handleDetailLoaded}
            />
          ))}

          {/* 円の下のメタラベル ＝ 発酵履歴への入口。
              円そのものはカメラを寄せる取っ手のままにして（ズームで読む・中身を並べ替える
              体験を残す）、履歴はここから入る。world 座標に置くのでズームに自然に乗る。
              位置は円の半径から出す（固定 px オフセットにしない）。 */}
          {visibleQuestions.map((q, i) => {
            const results = byQuestion.get(q.id) ?? [];
            if (results.length === 0) return null;
            const pos = resolvedCirclePositions[i];
            const latest = results[results.length - 1];
            const hasUnread = results.some((r) => unreadFermentationIds.has(r.id));
            const dimmed = zoomedId !== null && zoomedId !== q.id;
            return (
              <button
                key={`meta-${q.id}`}
                type="button"
                data-canvas-no-pan=""
                data-verify-part="history-entry"
                onClick={(e) => {
                  e.stopPropagation();
                  openHistory(q.id);
                }}
                aria-label={t('history.open_aria', { question: q.currentText ?? '' })}
                className={`group absolute z-[4] flex -translate-x-1/2 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border-0 bg-transparent px-2 py-1 transition-opacity hover:bg-[rgba(140,133,126,0.08)] ${
                  dimmed ? 'pointer-events-none opacity-30' : 'opacity-100'
                }`}
                style={{
                  left: (pos.jarX / 100) * JAR_WORLD_WIDTH,
                  top: (pos.jarY / 100) * JAR_WORLD_HEIGHT + CIRCLE_SIZE / 2 + META_LABEL_GAP,
                  animation: 'fadeIn 0.5s ease-out forwards',
                }}
              >
                {/* 押せることを見せる取っ手。2 行ぶんの高さを持たせて、文字だけの
                    ラベル（＝ただの注記に見える）から「開けるもの」に変える。 */}
                {/* 枠と背景は **クラスで**指定する。インラインの style はどのクラスより強く、
                    group-hover の指定に勝ってしまう（ホバーの手応えが死ぬ）。 */}
                <span className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-md border border-[rgba(140,133,126,0.3)] bg-[rgba(253,251,247,0.5)] p-[4px] text-[var(--date-color)] transition-colors group-hover:border-[rgba(140,133,126,0.6)] group-hover:bg-[rgba(253,251,247,0.95)] group-hover:text-[var(--fg)]">
                  <HistoryStackIcon />
                </span>
                <span className="flex flex-col items-start gap-1">
                  <span
                    className="text-[9px] uppercase tracking-[0.3em] text-[var(--date-color)]"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    {t('history.fermentations_count', { count: pad2(results.length) })}
                  </span>
                  <span
                    className="flex items-center gap-[5px] text-[9px] tracking-[0.2em]"
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      color: hasUnread ? 'var(--ob-jar-warm)' : 'var(--date-color)',
                      opacity: hasUnread ? 1 : 0.7,
                    }}
                  >
                    {hasUnread && (
                      <span
                        className="block h-[5px] w-[5px] rounded-full"
                        style={{ background: 'var(--ob-jar-warm)' }}
                      />
                    )}
                    {toDateStamp(latest.createdAt)}
                    {hasUnread ? ` · ${t('history.new')}` : ''}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </CanvasViewport>

      {/* Question list (bottom center) */}
      {!zoomedId && historyQuestionId === null && (
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

      {/* 発酵履歴（Cover Flow）。
          CanvasViewport の **外側** に敷く。3D の perspective は変形した祖先の中では
          成立しないので、world ボックスの中に置くと円盤が平たく潰れる。 */}
      <FermentationCoverFlow
        questionId={historyQuestionId}
        questionText={visibleQuestions.find((q) => q.id === historyQuestionId)?.currentText ?? ''}
        results={historyResults}
        index={activeHistoryIndex}
        details={historyDetails}
        unreadFermentationIds={unreadFermentationIds}
        onIndexChange={handleHistoryIndexChange}
        onClose={closeHistory}
        onElementClick={(resultId, type, id, data) => {
          const question = visibleQuestions.find((q) => q.id === historyQuestionId);
          const result = historyResults.find((r) => r.id === resultId);
          handleElementClick(
            historyQuestionId ?? '',
            // どの回の結果かが分かるように、見出しに発酵日を添える。
            result
              ? `${question?.currentText ?? ''}　／　${toDateStamp(result.createdAt)} の発酵`
              : (question?.currentText ?? ''),
            type,
            id,
            data,
          );
        }}
        selectedElementId={selectedElementId}
      />

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
