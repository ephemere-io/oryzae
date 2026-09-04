/**
 * 開いた問いの円の中に、言葉・抜粋・手紙を置く座標（純関数）。
 *
 * PC は「あらかじめ決めた散らばった座標＋ユーザーがドラッグして動かせる」だが、SP は
 * 画面が狭く指も太いので、**重ならないことを構造で保証する**方を採る。同心の輪の上に
 * 等間隔で置けば、数が増えても間隔が縮むだけで重なりはしない。
 *
 * 座標は円の直径に対する % （0-100）。円の大きさが変わっても比率で効く。
 */

export interface ZoomSlot {
  /** 円の左端からの % 。 */
  xPercent: number;
  /** 円の上端からの % 。 */
  yPercent: number;
}

/**
 * 半径 `radiusPercent`（円の直径に対する %）の輪の上に `count` 個を等間隔で置く。
 *
 * `startAngle` は最初の 1 個の角度（rad・真上が 0、時計回り）。輪ごとにずらすと、
 * 内側と外側の要素が同じ方角で重なるのを避けられる。
 */
export function ringSlots(count: number, radiusPercent: number, startAngle: number): ZoomSlot[] {
  if (count <= 0) return [];
  // 1 個だけなら輪に置かず中央からわずかに外す（中央は手紙の席）。
  const slots: ZoomSlot[] = [];
  for (let i = 0; i < count; i++) {
    const theta = startAngle + (i / count) * Math.PI * 2;
    slots.push({
      xPercent: 50 + Math.sin(theta) * radiusPercent,
      yPercent: 50 - Math.cos(theta) * radiusPercent,
    });
  }
  return slots;
}
