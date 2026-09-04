/**
 * 対象ラベルの画面上の置き方（`docs/oryzae-study/21-3d-parameters.md`「対象ラベル」）。
 *
 * 投影そのものは scene が行う。ここはその結果を画面に収める規則だけを持つ純関数。
 */

/** ラベルの見た目（PC）。3px の点 + 9px の機械ラベル。 */
export const LABEL_STYLE = {
  fontSize: 9,
  letterSpacing: '0.24em',
  color: '#5C4F3F',
  dotSize: 3,
  dotColor: '#A8A381',
  /** 既定の不透明度。その対象をホバーすると 1.0 になる。 */
  restOpacity: 0.5,
  hoverOpacity: 1,
  /** 濃さが変わる時間（ms）。 */
  fadeMs: 250,
} as const;

/**
 * SP のピルの下限の高さ。
 *
 * **`min-height` として明示すること。** パディングだけで作ると文字量で高さが変わり、
 * 短い状態語のときに下限を割る。
 */
export const PILL_MIN_HEIGHT = 44;

/** 画面の縁に残す余白（px）。 */
const SCREEN_MARGIN = 10;

export interface ScreenBox {
  width: number;
  height: number;
}

export interface PillSize {
  width: number;
  height: number;
}

/**
 * 投影した位置にオフセットを足し、画面の内側へ押し戻す。
 *
 * 返すのはピルの**中心**の座標。狭い端末では投影位置がそのまま画面外に出るので、
 * ここで必ず内側へ寄せる（「ピルが画面の端で切れない」— 40-acceptance.md）。
 */
export function clampPillToScreen(
  projected: { x: number; y: number },
  offset: { x: number; y: number },
  pill: PillSize,
  screen: ScreenBox,
): { x: number; y: number } {
  const halfW = pill.width / 2;
  const halfH = pill.height / 2;

  // ピルが画面より大きいときは、押し戻しの上下限が逆転する。中央に置いて諦める
  // （clamp の順序に任せると min > max で NaN じみた値になる）。
  const minX = halfW + SCREEN_MARGIN;
  const maxX = screen.width - halfW - SCREEN_MARGIN;
  const minY = halfH + SCREEN_MARGIN;
  const maxY = screen.height - halfH - SCREEN_MARGIN;

  return {
    x: minX > maxX ? screen.width / 2 : clamp(projected.x + offset.x, minX, maxX),
    y: minY > maxY ? screen.height / 2 : clamp(projected.y + offset.y, minY, maxY),
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * SP のピルに添える状態語のキー。
 *
 * readiness は SP でも**数値にしない**（「コピー」の規則に従う）。
 */
export function jarPillStateKey(
  status: 'idle' | 'fermenting' | 'completed',
  readiness: number,
): 'pill_jar_empty' | 'pill_jar_fermenting' | 'pill_jar_almost' | 'pill_jar_letter' {
  if (status === 'completed') return 'pill_jar_letter';
  if (status === 'idle') return 'pill_jar_empty';
  return readiness >= 0.9 ? 'pill_jar_almost' : 'pill_jar_fermenting';
}
