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
import { JarVessel } from '@/features/pc/fermentation/components/jar-vessel';
import {
  QUESTION_CIRCLE_SIZE,
  QuestionCircle,
} from '@/features/pc/fermentation/components/question-circle';
import { useJarDrag } from '@/features/pc/fermentation/hooks/use-jar-drag';
import { toDateStamp } from '@/features/pc/fermentation/utils/history-labels';
import { useFermentationDetails } from '@/features/shared/fermentation/hooks/use-fermentation-details';
import { useFermentationForQuestion } from '@/features/shared/fermentation/hooks/use-fermentation-for-question';
import { useFermentationHistory } from '@/features/shared/fermentation/hooks/use-fermentation-history';
import { useJarLayoutSave } from '@/features/shared/fermentation/hooks/use-jar-layout-save';
import type { FermentationDetail, JarLayout } from '@/features/shared/fermentation/types';
import type { ApiClient } from '@/lib/api';
import { useCanvasViewport } from '@/lib/canvas/use-canvas-viewport';
import type { Bounds } from '@/lib/canvas/viewport';
import { useUnread } from '@/lib/unread-context';
import { useElementResize } from '@/lib/use-element-resize';

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

/**
 * 「寄せ先」を覚えておく時間（ms）。詳細列の幅の transition（0.45s）を跨ぐ長さにする。
 *
 * 押した瞬間に列幅が変わりきっていないので、この間だけ寄せ直し続ける。長く持ちすぎると
 * その後に自分でパンした視点まで奪ってしまうので、動きが終わる分だけに留める。
 */
const FIT_INTENT_MS = 700;

/** 発酵履歴の印を円の下端からどれだけ離すか（world 単位）。 */
const META_LABEL_GAP = 18;
/**
 * 円の下に空けておく帯の高さ（world 単位）。
 *
 * 全体表示では発酵履歴の印がここに入り、円へ寄ったときは印が引っ込んで画面座標の
 * 操作面がこの帯の下に現れる。どちらの状態でも「円の真下に手が届く余地」が要るので、
 * 寄せる先の矩形にこのぶんを足しておく。多少大きめの見積もりでよい（余白が増えるだけ）。
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
  /**
   * 発酵瓶の readiness（issue #278）。瓶の見た目だけがこれに追従し、
   * 数値としては一切表示しない。
   * `top` が演出の段階を、`total` が賑やかさを決める（詳細は utils/jar-visuals.ts）。
   */
  readinessTop?: number;
  readinessTotal?: number;
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

/**
 * 発酵履歴への入口に添えるアイコン。時計＋反時計回りの矢印＝一般的な「履歴」記号。
 *
 * 独自の絵（円盤の束）も試したが、初見で意味が伝わる保証が無い。ここは発見してもらう
 * ことが仕事の取っ手なので、既に世の中で通じている記号に寄せる。
 *
 * 円弧は 12 時のすこし左（φ=345°）から時計回りに 315° 描き、左上に隙間を空けて
 * そこへ矢じりを置く（矢は反時計回り＝過去へ向かう向き）。線は太めにしてある ──
 * この取っ手は world の中にあり、俯瞰では 15px 前後まで縮むため。
 */
function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-full w-full">
      <path
        d="M9.93 4.27 A 8 8 0 1 1 5.07 8"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      {/* 反時計回りを示す矢じり（円弧の始点に付ける） */}
      <path d="M6.45 5.2 L 9.18 1.47 L 10.68 7.07 Z" fill="currentColor" />
      {/* 針: 12 時と 4 時 */}
      <path
        d="M12 7.6 V 12.2 L 15.4 14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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
      // 開いた円では円周の問いを消す。同じ文が上部の見出しに出るので、回り続けると二重になる。
      showRing={!isZoomed}
      innerOverrides={innerOverrides}
      selectedElementId={selectedElementId}
      onElementClick={(type, id, data) => onElementClick(question.id, '', type, id, data)}
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
  readinessTop = 0,
  readinessTotal = 0,
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
  const { markQuestionRead, unreadQuestionIds, unreadFermentationIds } = useUnread();

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
  /** 詳細列の見出しに添える「どの回か」。問いは入れない（上部に 1 か所）。 */
  const [detailContext, setDetailContext] = useState('');
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

  /**
   * キャンバス列の実体。ref ではなく state で持つ。
   *
   * `authLoading` の間は JarView が null を返すのでこの要素はまだ無い。ref だと
   * 「後から現れた」ことに気づけず、監視が張られないままになる（`useCanvasViewport` が
   * frame を state で持っているのと同じ理由）。
   */
  const [canvasAreaEl, setCanvasAreaEl] = useState<HTMLDivElement | null>(null);

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

  /**
   * 直前の「寄せ先」。**列幅が変わりきるまで**、カメラをここへ寄せ直し続ける。
   *
   * 詳細列は 0.45s かけて畳まれるので、押した瞬間の `fitTo` は **畳まれる前の幅**で
   * 倍率を決めてしまう。円を閉じたときにこれが効いていて、列が消えて広がったぶんが
   * 倍率に入らず、FIT ボタンより一段引いた絵で止まっていた（実測 33% / FIT は 47%）。
   * 幅が横に効いているあいだは横が、広がりきると縦が制約になる ── その差がまるごと出る。
   */
  const fitIntentRef = useRef<Bounds | null>(null);
  const fitIntentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fitWithIntent = useCallback(
    (bounds: Bounds) => {
      fitIntentRef.current = bounds;
      if (fitIntentTimer.current) clearTimeout(fitIntentTimer.current);
      fitIntentTimer.current = setTimeout(() => {
        fitIntentRef.current = null;
      }, FIT_INTENT_MS);
      fitTo(bounds);
    },
    [fitTo],
  );

  useEffect(
    () => () => {
      if (fitIntentTimer.current) clearTimeout(fitIntentTimer.current);
    },
    [],
  );

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

  /**
   * 詳細列の開閉でキャンバス列の幅が変わる。円を開いている間は、幅が変わっていくあいだ
   * ずっと寄せ直して、円が列の中央に居続けるようにする（CSS の transition にカメラが追従する）。
   *
   * window の resize ではなく **この列の大きさ**を見る。詳細列が開いてもウィンドウの
   * 大きさは変わらないので、resize では気づけない。
   */
  useElementResize(
    canvasAreaEl,
    useCallback(() => {
      // 直前に「ここへ寄せる」と決めた矩形があればそれを優先する。**閉じるときは
      // 円が無くなるので、これが無いと畳まれて広がったぶんを誰も反映しない。**
      const target = fitIntentRef.current ?? circleBoundsRef.current.focused;
      // 何も開いていないときは動かさない（自分でパンした視点を勝手に戻さない）。
      if (target) fitTo(target);
    }, [fitTo]),
  );

  /**
   * 瓶の中に漂う言葉。
   *
   * 既定の語（発酵 / 記憶 / …）ではなく、**その人の発酵が生んだキーワード**を流す。
   * 瓶の中身が自分の言葉になることが、この画面のいちばん強い手応えになる。
   * まだ 1 件も発酵していない人には空を渡し、`JarVessel` の既定語に任せる
   * （空の瓶にはしない。既定語の持ち主は瓶なので、こちらには置かない）。
   */
  const jarWords = useMemo(() => {
    const keywords = Object.values(detailByQuestion)
      .flatMap((detail) => detail?.keywords ?? [])
      .map((k) => k.keyword)
      .filter((word) => word.length > 0);
    return [...new Set(keywords)];
  }, [detailByQuestion]);

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
      contextLabel: string,
      type: 'keyword' | 'snippet' | 'letter',
      id: string,
      data: Record<string, string>,
    ) => {
      setDetailQuestionId(questionId);
      setDetailContext(contextLabel);
      setDetailType(type);
      setDetailData(data);
      setSelectedElementId(id);
      setDetailOpen(true);
    },
    [],
  );

  /**
   * 円になっていない問いの手紙を既読にする。
   *
   * 瓶は問いを 3 つまでしか出さない。それを超えた問い（アーカイブ済みも含む）の手紙は、
   * この画面からは開きようがない ── なのに未読として数えられ続けると、ナビのバッジが
   * 二度と減らなくなる（既読の単位を「瓶を開いた＝全部既読」から「その問いの履歴を
   * 開いた」に変えたときに生まれた穴で、実データで 4 件が張り付いていた）。
   *
   * 以前は瓶を開いた時点で全部を既読にしていたので、ここで潰すのは **その頃より狭い**
   * 範囲でしかない。開ける手紙の未読は今までどおり残る。
   */
  useEffect(() => {
    if (unreadQuestionIds.size === 0) return;
    const reachable = new Set(questions.slice(0, 3).map((q) => q.id));
    for (const questionId of unreadQuestionIds) {
      if (!reachable.has(questionId)) markQuestionRead(questionId);
    }
  }, [unreadQuestionIds, questions, markQuestionRead]);

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
    fitWithIntent(JAR_WORLD_BOUNDS);
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
      fitWithIntent(JAR_WORLD_BOUNDS);
      return;
    }
    const index = visibleQuestions.findIndex((q) => q.id === id);
    if (index >= 0) fitWithIntent(circleFocusBounds(resolvedCirclePositions[index]));
  }

  function handleFit() {
    setZoomedId(null);
    fitWithIntent(JAR_WORLD_BOUNDS);
  }

  /**
   * 詳細列を出すか。**中身を選んだかではなく、問いの中に入っているかで決める。**
   *
   * 選ぶたびに列が出入りすると、そのたびにキャンバス列の幅が変わって円が動く。読む対象を
   * 渡り歩くのがこの画面の主な使われ方なので、入った時点で場所を空けておく。
   */
  const detailColumnVisible = zoomedId !== null || historyQuestionId !== null;

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
      className="relative flex h-full w-full bg-[var(--bg)]"
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

      {/*
        左＝キャンバス列。詳細列が開くと **覆われるのではなく狭くなる**。
        円や円盤が隠れないまま隣で読める、というのがこの並べ方の狙い。
      */}
      <div ref={setCanvasAreaEl} className="relative min-w-0 flex-1">
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
              #533 で world ボックスに合わせて 420×520 → 500×620 に拡大している。
              中を漂う言葉は、その人の発酵が生んだキーワード（無ければ瓶の既定語）。 */}
            <JarVessel
              top={readinessTop}
              total={readinessTotal}
              width={500}
              height={620}
              words={jarWords}
            />

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

            {/* 円の下の印 ＝ 発酵履歴があることの合図。
              **文字は出さない。** 全体表示では world の 9px が実寸 4.6px にしかならず、
              読ませようがない。読めない文字を描くのはやめて、件数と未読だけを図で置く。
              押して開くのは画面座標に出す操作面（下の HistoryLauncher）の仕事。
              位置は円の半径から出す（固定 px オフセットにしない）。 */}
            {visibleQuestions.map((q, i) => {
              const results = byQuestion.get(q.id) ?? [];
              if (results.length === 0) return null;
              const pos = resolvedCirclePositions[i];
              const hasUnread = results.some((r) => unreadFermentationIds.has(r.id));
              // 開いている円の印は出さない。画面座標の操作面（HistoryLauncher）が
              // その役を引き継ぐので、両方出すと同じ入口が重なって見える。
              if (zoomedId === q.id) return null;
              const dimmed = zoomedId !== null;
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
                  className={`group absolute z-[4] flex -translate-x-1/2 cursor-pointer items-center gap-1.5 rounded-full border border-[rgba(140,133,126,0.3)] bg-[rgba(253,251,247,0.5)] px-2.5 py-1.5 transition-colors hover:border-[rgba(140,133,126,0.6)] hover:bg-[rgba(253,251,247,0.95)] ${
                    dimmed ? 'pointer-events-none opacity-30' : 'opacity-100'
                  }`}
                  style={{
                    left: (pos.jarX / 100) * JAR_WORLD_WIDTH,
                    top: (pos.jarY / 100) * JAR_WORLD_HEIGHT + CIRCLE_SIZE / 2 + META_LABEL_GAP,
                    color: hasUnread ? 'var(--ob-jar-warm)' : 'var(--date-color)',
                    animation: 'fadeIn 0.5s ease-out forwards',
                  }}
                >
                  <span className="block h-[18px] w-[18px] shrink-0 transition-colors group-hover:text-[var(--fg)]">
                    <HistoryIcon />
                  </span>
                  {/* 件数だけは数字で出す。1 文字なら潰れた大きさでも形が残る。 */}
                  <span
                    className="text-[11px] leading-none transition-colors group-hover:text-[var(--fg)]"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    {results.length}
                  </span>
                  {/* 未読は呼吸させる。押してほしい動機はここにしかない。 */}
                  {hasUnread && (
                    <span
                      data-verify-part="history-unread-dot"
                      className="block h-[5px] w-[5px] shrink-0 rounded-full"
                      style={{
                        background: 'var(--ob-jar-warm)',
                        animation: 'j2-pulse 2.4s cubic-bezier(0.4,0,0.6,1) infinite',
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </CanvasViewport>

        {/* 問いは画面上部の 1 か所だけ。円を開くと円周の問いが消え、ここへ移る
          （履歴を見ている間は Cover Flow が同じ位置に出すので、ここでは出さない）。 */}
        {zoomedId !== null && historyQuestionId === null && (
          <div className="pointer-events-none absolute top-6 left-1/2 z-[30] -translate-x-1/2">
            <span
              className="text-[15px] tracking-[0.06em] text-[var(--fg)]"
              style={{
                fontFamily: "'Noto Serif JP', serif",
                animation: 'fadeIn 0.5s ease-out forwards',
              }}
            >
              {visibleQuestions.find((q) => q.id === zoomedId)?.currentText ?? ''}
            </span>
          </div>
        )}

        {/*
        円を開いている間の履歴への入口。**world の外＝画面座標**に置く。

        world の中の印は全体表示で 4〜5px まで縮むので、押せる面としては当てにできない。
        履歴を見るのは寄ったときなので、寄った状態でだけ「常に同じ大きさで読める操作面」を
        出す、と表示の重さを実際の使われ方に合わせる。
      */}
        {zoomedId !== null &&
          historyQuestionId === null &&
          (() => {
            const question = visibleQuestions.find((q) => q.id === zoomedId);
            const results = question ? (byQuestion.get(question.id) ?? []) : [];
            if (!question || results.length === 0) return null;
            const latest = results[results.length - 1];
            const hasUnread = results.some((r) => unreadFermentationIds.has(r.id));
            return (
              <div className="absolute bottom-12 left-1/2 z-[30] -translate-x-1/2">
                <button
                  type="button"
                  data-verify-part="history-launcher"
                  onClick={() => openHistory(question.id)}
                  aria-label={t('history.open_aria', { question: question.currentText ?? '' })}
                  className="group flex items-center gap-3 rounded-full border border-[var(--border-subtle)] bg-[rgba(253,251,247,0.72)] py-2.5 pr-5 pl-3.5 transition-colors hover:bg-[rgba(253,251,247,0.95)]"
                  style={{
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    boxShadow: '0 4px 16px rgba(140,133,126,0.12)',
                    animation: 'fadeIn 0.4s ease-out forwards',
                  }}
                >
                  <span
                    className="block h-[22px] w-[22px] shrink-0 transition-colors group-hover:text-[var(--fg)]"
                    style={{ color: hasUnread ? 'var(--ob-jar-warm)' : 'var(--date-color)' }}
                  >
                    <HistoryIcon />
                  </span>
                  <span className="flex flex-col items-start gap-0.5">
                    <span
                      className="text-[12px] tracking-[0.06em] text-[var(--fg)]"
                      style={{ fontFamily: "'Noto Serif JP', serif" }}
                    >
                      {t('history.launcher', { count: results.length })}
                    </span>
                    <span
                      className="flex items-center gap-1.5 text-[9px] tracking-[0.2em]"
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        color: hasUnread ? 'var(--ob-jar-warm)' : 'var(--date-color)',
                      }}
                    >
                      {hasUnread && (
                        <span
                          className="block h-[5px] w-[5px] rounded-full"
                          style={{
                            background: 'var(--ob-jar-warm)',
                            animation: 'j2-pulse 2.4s cubic-bezier(0.4,0,0.6,1) infinite',
                          }}
                        />
                      )}
                      {toDateStamp(latest.createdAt)}
                      {hasUnread ? ` · ${t('history.new')}` : ''}
                    </span>
                  </span>
                </button>
              </div>
            );
          })()}

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
                className="rounded-full border border-dashed border-[var(--date-color)] px-3 py-1 text-[10px] tracking-[0.1em] text-[var(--date-color)] transition-all hover:bg-[var(--hover-wash)]"
                style={{ fontFamily: "'Noto Sans JP', sans-serif" }}
              >
                {t('jar.add_question')}
              </button>
            )}
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
          innerOverrides={{
            keywords: overrides.keywords,
            snippets: overrides.snippets,
            letters: overrides.letters,
          }}
          onInnerDragMove={(type, id, x, y) => handleInnerDragMove(type, id, { jarX: x, jarY: y })}
          onInnerDragEnd={(type, id, x, y) => handleInnerDragEnd(type, id, { jarX: x, jarY: y })}
          onIndexChange={handleHistoryIndexChange}
          onClose={closeHistory}
          paneOpen={detailOpen}
          onElementClick={(resultId, type, id, data) => {
            const result = historyResults.find((r) => r.id === resultId);
            handleElementClick(
              historyQuestionId ?? '',
              // どの回のものかは発酵日だけで足りる。問いは上部の見出しが 1 か所で持つ。
              result ? t('history.context', { date: toDateStamp(result.createdAt) }) : '',
              type,
              id,
              data,
            );
          }}
          selectedElementId={selectedElementId}
        />
      </div>

      {/* 右＝詳細列。円を開いている / 履歴を見ている間はずっと出しておく。
          中身を選ぶたびに現れたり消えたりすると、そのたびに円の位置が動く。 */}
      <DetailPane
        visible={detailColumnVisible}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedElementId(null);
        }}
        questionId={detailQuestionId}
        contextLabel={detailContext}
        type={detailType}
        data={detailData}
      />

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
                className="rounded-full border border-[var(--border-subtle)] bg-transparent px-5 py-2 text-[11px] text-[var(--date-color)] transition-all hover:bg-[var(--hover-wash)] disabled:opacity-50"
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
                className="rounded-full border border-[var(--border-subtle)] bg-transparent px-5 py-2 text-[11px] text-[var(--date-color)] transition-all hover:bg-[var(--hover-wash)] disabled:opacity-50"
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
    </div>
  );
}
