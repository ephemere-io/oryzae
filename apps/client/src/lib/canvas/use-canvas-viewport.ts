'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  type Bounds,
  fitBounds,
  IDENTITY_VIEWPORT,
  normalizeViewport,
  type Point,
  panBy,
  type Size,
  screenToWorld,
  toTransform,
  type Viewport,
  viewportCenterWorld,
  zoomAt,
  zoomTo,
} from './viewport';

/** ボタン1回・キーボード1回あたりの倍率。 */
const ZOOM_STEP = 1.25;
/** ctrl/⌘+ホイールの deltaY → 倍率の感度。exp を噛ませて方向によらず対称にする。 */
const WHEEL_ZOOM_SENSITIVITY = 0.0022;
/** deltaMode=DOM_DELTA_LINE のホイール（一部のマウス）を px に換算する係数。 */
const LINE_HEIGHT_PX = 16;
/** ジェスチャ中は DOM だけ更新し、止まってからこの時間後に React state へ反映する。 */
const COMMIT_IDLE_MS = 120;
/**
 * 初期フィットで frame を採寸できるまで待つ最大フレーム数。
 * レイアウト確定が遅れる場合の保険で、超えたら等倍で開いて先へ進む（無限リトライ防止）。
 */
const INITIAL_FIT_MAX_FRAMES = 60;

export interface CanvasViewportOptions {
  /**
   * localStorage のキー。省略するとビューポートを永続化しない。
   * 画面ごとに変えること（例: `board`, `jar`）。
   */
  storageKey?: string;
  /**
   * 保存済みビューポートが無いときの初期表示（world 矩形）。
   *
   * 瓶のように **世界の大きさが決まっている** 画面で使う。等倍で開くと世界が画面から
   * はみ出すため、初回だけこの矩形が収まる倍率に合わせる。ボードのように無限に広がる
   * 画面では省略し、等倍で開く。
   *
   * マウント時に一度だけ読むので、参照が毎回変わっても再実行されない。
   */
  defaultFitBounds?: Bounds;
  /**
   * 「全体表示」（Shift+1）で収める world 矩形を返す。中身が変わるので毎回呼ぶ。
   * null を返したら等倍にリセットする。
   */
  getContentBounds?: () => Bounds | null;
  /**
   * 「選択に寄る」（Shift+2）で収める world 矩形を返す。選択が無ければ null。
   */
  getSelectionBounds?: () => Bounds | null;
}

export interface CanvasSurface {
  /**
   * React 側から読むビューポート。**ジェスチャ中は更新されない**（描画は DOM 直書き）。
   * 倍率表示や LOD 判定など、1フレーム遅れて構わない用途にだけ使う。
   */
  viewport: Viewport;
  isPanning: boolean;
  /**
   * frame（ビューポート要素）に付ける **コールバック ref**。
   * 要素の出入りを hook が検知するためで、条件付きで描画される画面でも
   * リスナ登録と初期フィットが取りこぼされない。
   */
  frameRef: React.RefCallback<HTMLDivElement>;
  worldRef: React.RefObject<HTMLDivElement | null>;
  /** `clientX`/`clientY`（ページ座標）→ world 座標。 */
  toWorld: (clientX: number, clientY: number) => Point;
  /** frame 中心の world 座標。新規要素をいま見えている場所に置くために使う。 */
  centerWorld: () => Point;
  /** frame の現在の px サイズ。未マウント時は 0×0。 */
  frameSize: () => Size;
  zoomIn: () => void;
  zoomOut: () => void;
  /** 等倍に戻し、`bounds` があればその中心へ寄せる。 */
  resetZoom: () => void;
  /** `bounds`（world 矩形）が画面に収まるまでズーム。null なら等倍リセット。 */
  fitTo: (bounds: Bounds | null) => void;
  /**
   * ビューポートが DOM に反映されるたびに呼ばれる購読。解除関数を返す。
   *
   * `viewport`（state）はジェスチャ中に更新されないため、ミニマップのように
   * **毎フレーム追従したい** 表示はこちらを使う。React の再描画は起こさない。
   */
  subscribe: (listener: (viewport: Viewport) => void) => () => void;
}

/**
 * Figma 的なパン・ズームを1つの transform ノードに集約する hook。
 *
 * 設計の要点:
 *
 * 1. **transform の書き手はこの hook だけ。** React の style prop には transform を置かない。
 *    ジェスチャ中に別の理由（データ到着など）で再描画が走っても、古い state の transform で
 *    上書きされて画面が飛ぶことがなくなる。
 * 2. **ジェスチャ中は state を更新しない。** ホイールは毎秒100イベント以上来るので、
 *    そのたびに再描画するとカード全部が再レンダリングされる。ref を真実として rAF で
 *    DOM に書き、止まってから {@link COMMIT_IDLE_MS} 後に state へ反映する。
 * 3. **ホイールは native listener で取る。** React の `onWheel` は passive 登録なので
 *    `preventDefault()` が効かず、ブラウザのページズームが割り込む。
 * 4. **パンは capture フェーズの native listener。** カード側の `stopPropagation()` に
 *    邪魔されずに space+ドラッグ・中ボタンドラッグを拾える。
 *
 * 逆スケールしたい装飾（選択枠・ハンドル）のために frame へ `--vp-scale` を publish する。
 * CSS 側は `calc(1px / var(--vp-scale, 1))` のように使えば再描画なしで太さを一定に保てる。
 */
export function useCanvasViewport(options: CanvasViewportOptions = {}): CanvasSurface {
  const { storageKey } = options;

  // マウント時の初期表示にだけ使う。ref 経由で読むことで、呼び出し側が
  // オブジェクトリテラルを毎回作っても復元 effect が再実行されない。
  const defaultFitBoundsRef = useRef(options.defaultFitBounds);
  defaultFitBoundsRef.current = options.defaultFitBounds;

  // ショートカットから毎回呼ぶ。ref 越しにするのは、呼び出し側が毎レンダー新しい関数を
  // 渡してもキーボードのリスナを張り直さずに済ませるため。
  const getContentBoundsRef = useRef(options.getContentBounds);
  getContentBoundsRef.current = options.getContentBounds;
  const getSelectionBoundsRef = useRef(options.getSelectionBounds);
  getSelectionBoundsRef.current = options.getSelectionBounds;

  // frame は **state で持つ**（ただの ref ではない）。
  //
  // 呼び出し側は読み込み中に null を返すことがあり（JarView の `if (authLoading) return null`）、
  // その場合フレームはマウントより後から現れる。ref だと「フレームが付いた」ことに気づけず、
  // ホイール・パンのリスナが張られないまま・初期フィットも効かないままになる。
  // state にしておけば要素が現れた時点で下の effect 群が張り直される。
  const [frameEl, setFrameEl] = useState<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);

  const [viewport, setViewport] = useState<Viewport>(IDENTITY_VIEWPORT);
  const [isPanning, setIsPanning] = useState(false);

  /** 描画の真実。state はここから遅れて追従するスナップショット。 */
  const vpRef = useRef<Viewport>(IDENTITY_VIEWPORT);
  const rafRef = useRef<number | null>(null);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spaceDownRef = useRef(false);

  /** 毎フレームの反映を受け取る購読者（ミニマップなど）。 */
  const listenersRef = useRef(new Set<(viewport: Viewport) => void>());

  const subscribe = useCallback((listener: (viewport: Viewport) => void) => {
    const listeners = listenersRef.current;
    listeners.add(listener);
    listener(vpRef.current);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  /** ref の値を DOM に書く。rAF から呼ばれるのでここでは state を触らない。 */
  const paint = useCallback(() => {
    const vp = vpRef.current;
    if (worldRef.current) worldRef.current.style.transform = toTransform(vp);
    if (frameEl) frameEl.style.setProperty('--vp-scale', String(vp.scale));
    for (const listener of listenersRef.current) listener(vp);
  }, [frameEl]);

  /**
   * ビューポートを state に反映する。**値が変わっていなければ更新しない。**
   *
   * 無駄な再描画を消すためだけでなく、検証ハーネスのように「描画してすぐ DOM を読む」
   * 経路で、あとから来る no-op な state 更新が再描画を起こして結果を揺らすのを防ぐ。
   */
  const syncViewport = useCallback(() => {
    setViewport((prev) => {
      const next = vpRef.current;
      return prev.x === next.x && prev.y === next.y && prev.scale === next.scale ? prev : next;
    });
  }, []);

  const commit = useCallback(() => {
    commitTimerRef.current = null;
    syncViewport();
  }, [syncViewport]);

  /** ビューポートを更新する唯一の入口。DOM は次フレーム、state は静止後に追従する。 */
  const apply = useCallback(
    (next: Viewport) => {
      vpRef.current = normalizeViewport(next);
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          paint();
        });
      }
      if (commitTimerRef.current !== null) clearTimeout(commitTimerRef.current);
      commitTimerRef.current = setTimeout(commit, COMMIT_IDLE_MS);
    },
    [paint, commit],
  );

  /** frame の矩形。未マウント時は null（jsdom もここを通る）。 */
  const frameRect = useCallback((): DOMRect | null => {
    return frameEl?.getBoundingClientRect() ?? null;
  }, [frameEl]);

  const frameSize = useCallback((): Size => {
    const rect = frameRect();
    return { width: rect?.width ?? 0, height: rect?.height ?? 0 };
  }, [frameRect]);

  const toWorld = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = frameRect();
      return screenToWorld(vpRef.current, clientX - (rect?.left ?? 0), clientY - (rect?.top ?? 0));
    },
    [frameRect],
  );

  const centerWorld = useCallback(
    (): Point => viewportCenterWorld(vpRef.current, frameSize()),
    [frameSize],
  );

  /** frame 中心を軸にした段階ズーム（ボタン・キーボード用）。 */
  const zoomByStep = useCallback(
    (factor: number) => {
      const size = frameSize();
      apply(zoomAt(vpRef.current, size.width / 2, size.height / 2, factor));
    },
    [apply, frameSize],
  );

  const zoomIn = useCallback(() => zoomByStep(ZOOM_STEP), [zoomByStep]);
  const zoomOut = useCallback(() => zoomByStep(1 / ZOOM_STEP), [zoomByStep]);

  const resetZoom = useCallback(() => {
    const size = frameSize();
    apply(zoomTo(vpRef.current, 1, size.width / 2, size.height / 2));
  }, [apply, frameSize]);

  const fitTo = useCallback(
    (bounds: Bounds | null) => {
      if (!bounds) {
        resetZoom();
        return;
      }
      const size = frameSize();
      if (size.width === 0 || size.height === 0) return;
      apply(fitBounds(bounds, size));
    },
    [apply, frameSize, resetZoom],
  );

  // ── 保存済みビューポートの復元 ──────────────────────────────────
  // useLayoutEffect なのは、描画前に適用してリロード時のガタつきを消すため。
  // state の初期値で localStorage を読まないのは、SSR とハイドレーションで
  // 値が食い違うのを避けるため（この画面は現状クライアント専用だが前提を作らない）。
  // frame が実際に現れて採寸できた時点で一度だけ初期化する。
  // 読み込み中に null を返す画面ではマウント直後にはまだ frame が無いため、
  // 「マウント時に1回」ではなく「frame が付いたとき」を起点にする。
  const didInitRef = useRef(false);
  useLayoutEffect(() => {
    if (!frameEl || didInitRef.current) return;
    let raf = 0;
    let attemptsLeft = INITIAL_FIT_MAX_FRAMES;

    const attempt = () => {
      if (didInitRef.current) return;
      const restored = storageKey ? readStoredViewport(storageKey) : null;
      const bounds = defaultFitBoundsRef.current;

      if (restored) {
        // 復元は採寸不要（保存値がそのまま答え）。
        vpRef.current = restored;
      } else if (bounds) {
        const size = frameSize();
        if (size.width === 0 || size.height === 0) {
          // レイアウト確定前。数フレームだけ待って測り直す（諦めたら等倍で開く）。
          if (attemptsLeft-- > 0) {
            raf = requestAnimationFrame(attempt);
            return;
          }
        } else {
          vpRef.current = fitBounds(bounds, size);
        }
      }

      didInitRef.current = true;
      paint();
      syncViewport();
    };

    attempt();
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [frameEl, storageKey, paint, frameSize, syncViewport]);

  // frame が現れる前に paint しても DOM が無いので、付いた直後に一度描き直す。
  useLayoutEffect(() => {
    if (frameEl) paint();
  }, [frameEl, paint]);

  // 初期化が終わるまでは保存しない。
  // frame が現れるまで初期化は走らないので、その前に等倍を書き込むと
  // **保存済みのビューポートを自分で潰して** しまい、復元も初期フィットも効かなくなる。
  useEffect(() => {
    if (!storageKey || !didInitRef.current) return;
    writeStoredViewport(storageKey, viewport);
  }, [storageKey, viewport]);

  // ── ホイール: ctrl/⌘ でカーソル基点ズーム、素の回転でパン ──────────
  useEffect(() => {
    const frame = frameEl;
    if (!frame) return;

    const onWheel = (e: WheelEvent) => {
      // passive:false で登録しているのでここで止められる。
      // 止めないとブラウザのページズーム・戻るスワイプが割り込む。
      e.preventDefault();

      const factor = e.deltaMode === 1 ? LINE_HEIGHT_PX : 1;
      const dx = e.deltaX * factor;
      const dy = e.deltaY * factor;

      // トラックパッドのピンチは ctrlKey 付きの wheel として届く。
      if (e.ctrlKey || e.metaKey) {
        const rect = frame.getBoundingClientRect();
        apply(
          zoomAt(
            vpRef.current,
            e.clientX - rect.left,
            e.clientY - rect.top,
            Math.exp(-dy * WHEEL_ZOOM_SENSITIVITY),
          ),
        );
        return;
      }
      apply(panBy(vpRef.current, -dx, -dy));
    };

    frame.addEventListener('wheel', onWheel, { passive: false });
    return () => frame.removeEventListener('wheel', onWheel);
  }, [apply, frameEl]);

  // ── パン（背景 / space+ドラッグ / 中ボタン）と 2本指ピンチ ──────────
  //
  // 1本指はパン、2本指はピンチ（拡大＋移動）。同じポインタ台帳で両方を見るのは、
  // 「1本目でパンを始めた直後に2本目が降りてくる」流れを取りこぼさないため。
  useEffect(() => {
    const frame = frameEl;
    if (!frame) return;

    /** frame 上で現在押されているポインタ。2本以上ならピンチに切り替える。 */
    const active = new Map<number, { x: number; y: number }>();
    let panId: number | null = null;
    let lastX = 0;
    let lastY = 0;
    /** 直前フレームの2本指の間隔と中点。差分から倍率と移動量を出す。 */
    let pinch: { dist: number; midX: number; midY: number } | null = null;

    function twoFingerState() {
      const [a, b] = [...active.values()];
      return {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        midX: (a.x + b.x) / 2,
        midY: (a.y + b.y) / 2,
      };
    }

    const onMove = (e: PointerEvent) => {
      if (!active.has(e.pointerId)) return;
      active.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (active.size >= 2) {
        const now = twoFingerState();
        if (pinch && pinch.dist > 0) {
          const rect = frame.getBoundingClientRect();
          // 2本指の中点を軸に拡大し、中点の移動ぶんだけ平行移動する。
          const zoomed = zoomAt(
            vpRef.current,
            now.midX - rect.left,
            now.midY - rect.top,
            now.dist / pinch.dist,
          );
          apply(panBy(zoomed, now.midX - pinch.midX, now.midY - pinch.midY));
        }
        pinch = now;
        return;
      }

      if (panId === e.pointerId) {
        apply(panBy(vpRef.current, e.clientX - lastX, e.clientY - lastY));
        lastX = e.clientX;
        lastY = e.clientY;
      }
    };

    const detachWindow = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    function onUp(e: PointerEvent) {
      if (!active.delete(e.pointerId)) return;
      if (active.size < 2) pinch = null;
      if (panId === e.pointerId) panId = null;
      if (active.size === 0) {
        setIsPanning(false);
        detachWindow();
      }
    }

    const attachWindow = () => {
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    };

    const startPan = (e: PointerEvent) => {
      panId = e.pointerId;
      lastX = e.clientX;
      lastY = e.clientY;
      setIsPanning(true);
    };

    // capture フェーズで受けるのは、カード側の stopPropagation() より先に
    // space+ドラッグ・中ボタンドラッグを奪うため。
    const onPointerDownCapture = (e: PointerEvent) => {
      const wasEmpty = active.size === 0;
      // ピンチ判定のため、カードの上で始まった指も含めて全ポインタを数える。
      active.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (wasEmpty) attachWindow();

      if (active.size >= 2) {
        // 2本目が降りたらピンチへ切り替える（1本目のパンは止める）。
        panId = null;
        pinch = twoFingerState();
        return;
      }

      if (panId !== null) return;
      const forced = e.button === 1 || (e.button === 0 && spaceDownRef.current);
      if (forced) {
        e.preventDefault();
        e.stopPropagation();
        startPan(e);
        return;
      }
      if (e.button !== 0) return;
      // 背景（frame / world そのもの）を押したときだけパン。カードの上では何もしない。
      if (e.target === frame || e.target === worldRef.current) startPan(e);
    };

    frame.addEventListener('pointerdown', onPointerDownCapture, { capture: true });
    return () => {
      frame.removeEventListener('pointerdown', onPointerDownCapture, { capture: true });
      detachWindow();
    };
  }, [apply, frameEl]);

  // ── space 押下中はパンモード（Figma と同じ） ───────────────────────
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      return (
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;

      if (e.code === 'Space') {
        spaceDownRef.current = true;
        return;
      }

      // ⌘/Ctrl + 0 / + / −: ブラウザのページズームを奪ってキャンバスのズームに割り当てる
      // （Figma と同じ。キャンバスアプリではページ全体が拡大される方が困る）。
      if (e.metaKey || e.ctrlKey) {
        if (e.key === '0') {
          e.preventDefault();
          resetZoom();
        } else if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          zoomIn();
        } else if (e.key === '-') {
          e.preventDefault();
          zoomOut();
        }
        return;
      }

      // Shift+1 = 全体表示 / Shift+2 = 選択に寄る。
      if (e.shiftKey && (e.key === '!' || e.code === 'Digit1')) {
        e.preventDefault();
        fitTo(getContentBoundsRef.current?.() ?? null);
      } else if (e.shiftKey && (e.key === '"' || e.key === '@' || e.code === 'Digit2')) {
        const selection = getSelectionBoundsRef.current?.();
        if (!selection) return;
        e.preventDefault();
        fitTo(selection);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      spaceDownRef.current = false;
    };
    // タブ移動などでキーアップを取り逃すと押しっぱなし扱いが残るため保険。
    const onBlur = () => {
      spaceDownRef.current = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [resetZoom, zoomIn, zoomOut, fitTo]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (commitTimerRef.current !== null) clearTimeout(commitTimerRef.current);
    };
  }, []);

  const frameRef = useCallback((el: HTMLDivElement | null) => {
    setFrameEl(el);
  }, []);

  return useMemo(
    () => ({
      viewport,
      isPanning,
      frameRef,
      worldRef,
      toWorld,
      centerWorld,
      frameSize,
      zoomIn,
      zoomOut,
      resetZoom,
      fitTo,
      subscribe,
    }),
    [
      viewport,
      isPanning,
      frameRef,
      toWorld,
      centerWorld,
      frameSize,
      zoomIn,
      zoomOut,
      resetZoom,
      fitTo,
      subscribe,
    ],
  );
}

function storageName(key: string): string {
  return `oryzae:viewport:${key}`;
}

function readStoredViewport(key: string): Viewport | null {
  try {
    const raw = window.localStorage.getItem(storageName(key));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    if (!('x' in parsed) || !('y' in parsed) || !('scale' in parsed)) return null;
    const { x, y, scale } = parsed;
    if (typeof x !== 'number' || typeof y !== 'number' || typeof scale !== 'number') return null;
    return normalizeViewport({ x, y, scale });
  } catch {
    // プライベートモード・容量超過・壊れた JSON。既定のビューポートで続行する。
    return null;
  }
}

function writeStoredViewport(key: string, viewport: Viewport): void {
  try {
    window.localStorage.setItem(storageName(key), JSON.stringify(viewport));
  } catch {
    // 保存できなくても操作は続けられる。
  }
}
