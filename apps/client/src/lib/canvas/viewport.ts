/**
 * キャンバスのビューポート変換（純関数・DOM 非依存）。
 *
 * ボード / 瓶を「無限に広がる world」として扱うための最小の数学だけを置く。
 * ズーム実装が壊れる原因はほぼ例外なく「scale がイベントハンドラに漏れる」ことなので、
 * 変換をこの1ファイルに閉じ込め、UI 側は screenToWorld / worldToScreen しか触らない。
 *
 * 座標系の約束:
 *   - world は要素が保持する論理座標（board なら `card.x/y` ＝ DB の値そのもの）。
 *   - screen は **frame（ビューポート要素）の左上を原点とした px**。`clientX` から
 *     frame の `getBoundingClientRect().left` を引いた値であって、ページ座標ではない。
 *   - 変換は `transform: translate(x, y) scale(s)` ＋ `transform-origin: 0 0` と等価:
 *
 *         screen = world * scale + (x, y)
 *         world  = (screen - (x, y)) / scale
 *
 * この2式以外で座標を触らないこと。DOM 側の transform 文字列も {@link toTransform} で作る。
 */

/** world → screen のアフィン変換。`x`/`y` は world 原点の screen 位置（px）。 */
export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 表示倍率の下限・上限。Figma（2%〜256%）より狭く、ジャーナルの用途に絞る。 */
/**
 * 「これ以上引けないのに、まだ引こうとした」を知らせるイベント。
 *
 * キャンバスは最小倍率で頭打ちになり、そこから先の引きは**どこにも行き場が無い**。
 * その余りを捨てずに上へ流す。何に使うか（＝どこへ出るのか）はここでは決めない —
 * `lib/` はドメインを知らないので、拾う側が決める。
 *
 * `bubbles: true` で投げるので、window で 1 か所だけ聞けば全キャンバスぶん拾える。
 * `detail.excess` は 0 より大きい実数で、1 回の操作でどれだけ引こうとしたか。
 */
export const OVERZOOM_OUT_EVENT = 'oryzae:canvas-overzoom-out';

export interface OverzoomOutDetail {
  excess: number;
}

export const MIN_SCALE = 0.2;

/**
 * 引きの余りを知らせ始める倍率。
 *
 * **最小に着いてからでは遅い。** 板は等倍で開き、最小（20%）まではつまみ 2〜3 回ぶんの
 * 距離がある。そのあいだ何の反応も無いので、「引いても何も起きない」と読まれて手が
 * 止まる（実機の指摘）。最小の少し手前から知らせ始めると、引くほど部屋が滲むのが
 * 見えるので、そのまま引き続ければ着くと分かる。
 */
export const OVERZOOM_ARM_SCALE = MIN_SCALE * 1.6;
export const MAX_SCALE = 3;

/** パン・ズームしていない初期状態。ハイドレーション前はこれで描く。 */
export const IDENTITY_VIEWPORT: Viewport = { x: 0, y: 0, scale: 1 };

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/** 保存値・外部入力を安全な Viewport に正規化する（NaN / Infinity を弾く）。 */
export function normalizeViewport(value: Viewport): Viewport {
  return {
    x: Number.isFinite(value.x) ? value.x : 0,
    y: Number.isFinite(value.y) ? value.y : 0,
    scale: clampScale(value.scale),
  };
}

export function worldToScreen(vp: Viewport, worldX: number, worldY: number): Point {
  return { x: worldX * vp.scale + vp.x, y: worldY * vp.scale + vp.y };
}

export function screenToWorld(vp: Viewport, screenX: number, screenY: number): Point {
  return { x: (screenX - vp.x) / vp.scale, y: (screenY - vp.y) / vp.scale };
}

/**
 * `anchor`（screen 座標）の真下にある world 点を固定したまま倍率を `factor` 倍する。
 * カーソル位置を軸にしたホイールズームと、ピンチズームの両方がこれ1本で足りる。
 *
 * クランプで倍率が頭打ちになった場合も **実際に適用された倍率** で平行移動を計算するため、
 * 上限・下限に張り付いた状態でホイールを回し続けても画面が流れない。
 */
export function zoomAt(vp: Viewport, anchorX: number, anchorY: number, factor: number): Viewport {
  const scale = clampScale(vp.scale * factor);
  const applied = scale / vp.scale;
  return {
    scale,
    x: anchorX - (anchorX - vp.x) * applied,
    y: anchorY - (anchorY - vp.y) * applied,
  };
}

/** `anchor` を固定したまま倍率を絶対値で設定する。 */
export function zoomTo(vp: Viewport, scale: number, anchorX: number, anchorY: number): Viewport {
  return zoomAt(vp, anchorX, anchorY, clampScale(scale) / vp.scale);
}

/** screen px 単位で平行移動する（倍率は変えない）。 */
export function panBy(vp: Viewport, dx: number, dy: number): Viewport {
  return { x: vp.x + dx, y: vp.y + dy, scale: vp.scale };
}

/**
 * `bounds`（world 矩形）が `size`（frame の px サイズ）に収まるビューポートを返す。
 * 全体表示と、特定要素へのズームインの両方に使う。
 */
export function fitBounds(bounds: Bounds, size: Size, padding = 64): Viewport {
  const boundsW = Math.max(bounds.width, 1);
  const boundsH = Math.max(bounds.height, 1);
  const availableW = Math.max(size.width - padding * 2, 1);
  const availableH = Math.max(size.height - padding * 2, 1);
  const scale = clampScale(Math.min(availableW / boundsW, availableH / boundsH));
  return {
    scale,
    x: size.width / 2 - (bounds.x + boundsW / 2) * scale,
    y: size.height / 2 - (bounds.y + boundsH / 2) * scale,
  };
}

/** frame の中心に対応する world 座標。新規要素の配置位置に使う。 */
export function viewportCenterWorld(vp: Viewport, size: Size): Point {
  return screenToWorld(vp, size.width / 2, size.height / 2);
}

/** 複数の world 矩形を包む最小の矩形。要素が無ければ null。 */
export function unionBounds(rects: readonly Bounds[]): Bounds | null {
  if (rects.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const rect of rects) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * world ノードに書く CSS transform。
 * `translate` → `scale` の順かつ `transform-origin: 0 0` であることが上の変換式の前提。
 * 順序を入れ替えると screenToWorld / worldToScreen が静かに壊れる。
 */
export function toTransform(vp: Viewport): string {
  return `translate(${vp.x}px, ${vp.y}px) scale(${vp.scale})`;
}
