/**
 * 画面の下に**重なっている**ブラウザのツールバーぶんを見積もる。
 *
 * ### なぜ CSS だけで避けられないか
 *
 * Safari は下のツールバーぶんを差し引いた高さを `100svh` として教えてくれる。ところが
 * アプリ内ブラウザ（Dia など）は、Web ビューを**画面いっぱいに置いたうえでツールバーを
 * その上に重ねて**描く。`svh` も `dvh` も `env(safe-area-inset-bottom)` も画面の高さのままで、
 * ページからは「下の数十 px が隠れている」ことが分からない。実機の Dia で、紙の下端
 * （「サインアップ」の行）がツールバーに隠れた（実機レビュー 2026-09-17）。
 *
 * ### どう見分けるか
 *
 * **ビューポートが画面ぴったりを覆っているか**を見る。ふつうのブラウザは自分のツールバーを
 * よけた高さを持つので、画面より小さい。ホーム画面に追加した PWA（`standalone`）と、
 * マウスの環境は対象外。
 *
 * 高さはブラウザが教えてくれないので、画面の高さに対する割合で見積もる。実測（iPhone 15 Pro・
 * Dia）で 852pt のうち 76pt = 8.9% だったので、少し余裕を持たせた割合を使う。
 */

/** 見分けに使う、そのときの画面の状態。 */
export interface ViewportSnapshot {
  innerWidth: number;
  innerHeight: number;
  screenWidth: number;
  screenHeight: number;
  /** 指で触る環境か（`pointer: coarse`）。 */
  coarsePointer: boolean;
  /** ホーム画面から開いた PWA か（`display-mode: standalone`）。 */
  standalone: boolean;
}

/**
 * ビューポートが画面を覆っているとみなす許容（px）。
 * ぴったり一致しない端末（1px の丸め・細い枠）を取りこぼさないための幅。
 */
const COVERS_SCREEN_SLACK = 8;

/**
 * 重なっているツールバーの高さの見積もり（画面の高さに対する割合）。
 *
 * 実測 8.9%（iPhone 15 Pro の Dia）に余裕を足したもの。**これ以上大きくしない** —
 * ツールバーが無い環境まで下が間延びする。
 */
const OVERLAY_TOOLBAR_RATIO = 0.11;

/**
 * 下に重なっているツールバーぶんの高さ（px）。重なっていなければ 0。
 *
 * 呼ぶのは**開いたときの 1 回だけ**にすること。スクロールでツールバーが畳まれるたびに
 * 測り直すと、紙が上下に跳ねる。
 */
export function overlayToolbarInset(snapshot: ViewportSnapshot): number {
  if (!snapshot.coarsePointer || snapshot.standalone) return 0;
  if (snapshot.screenHeight <= 0 || snapshot.innerHeight <= 0) return 0;

  // 縦と横で、画面のどちらの辺が「高さ」かが変わる（iOS の screen は回しても入れ替わらない）。
  const portrait = snapshot.innerHeight >= snapshot.innerWidth;
  const screenSide = portrait
    ? Math.max(snapshot.screenHeight, snapshot.screenWidth)
    : Math.min(snapshot.screenHeight, snapshot.screenWidth);

  // 画面より小さい＝ブラウザが自分でツールバーをよけている（Safari など）。何もしない。
  if (snapshot.innerHeight < screenSide - COVERS_SCREEN_SLACK) return 0;

  return Math.round(snapshot.innerHeight * OVERLAY_TOOLBAR_RATIO);
}

/** いまの画面から見積もる。ブラウザの外（SSR・テスト）では 0。 */
export function measureOverlayToolbarInset(): number {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 0;
  return overlayToolbarInset({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    screenWidth: window.screen?.width ?? 0,
    screenHeight: window.screen?.height ?? 0,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    standalone: window.matchMedia('(display-mode: standalone)').matches,
  });
}
