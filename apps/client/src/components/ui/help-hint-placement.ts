/**
 * HelpHint の説明をどこに出すか。
 *
 * **DOM に触らない計算**にしてあるのは、位置の決め方をレイアウトの無いテスト環境でも
 * 確かめられるようにするため。実寸は呼ぶ側（help-hint.tsx）が測って渡す。
 */

/** 「？」と説明のあいだ。 */
const GAP = 8;
/** 面・窓の縁から、説明を離しておく距離。 */
const EDGE = 8;
/** 説明の最大幅。これより広いと1行が長くなり、読み返しにくい。 */
const MAX_WIDTH = 240;
/** 右に出すのに要る最小の幅。これを割ると1行が数文字になり、縦に伸びすぎる。 */
const MIN_SIDE_WIDTH = 150;

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface HintPlacement {
  left: number;
  top: number;
  width: number;
  side: 'right' | 'below' | 'above';
}

interface PlaceHintInput {
  /** 「？」の実寸。 */
  anchor: Rect;
  /** 説明を収めたい面（設定パネルなど）。無ければ窓全体。 */
  bounds: Rect | null;
  viewport: { width: number; height: number };
  /** 幅を決めたときの高さ。説明は折り返すので、幅が決まるまで高さは分からない。 */
  measureHeight: (width: number) => number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function placeHint({
  anchor,
  bounds,
  viewport,
  measureHeight,
}: PlaceHintInput): HintPlacement {
  // 面が窓からはみ出していても、窓の外には出さない。
  const area = {
    left: Math.max(bounds?.left ?? 0, 0),
    right: Math.min(bounds?.right ?? viewport.width, viewport.width),
  };

  // まず右。「？」は名前のすぐ後ろ（行の左寄り）にあるので、右には行の残りがある。
  const sideLeft = anchor.right + GAP;
  const sideRoom = area.right - EDGE - sideLeft;
  if (sideRoom >= MIN_SIDE_WIDTH) {
    const width = Math.min(MAX_WIDTH, sideRoom);
    const height = measureHeight(width);
    const middle = (anchor.top + anchor.bottom) / 2;
    return {
      side: 'right',
      left: sideLeft,
      width,
      // 「？」の高さの中央に揃え、窓の上下からははみ出させない。
      top: clamp(middle - height / 2, EDGE, viewport.height - EDGE - height),
    };
  }

  // 右に入らなければ下（窓の下端に掛かるなら上）。面の幅の中で、「？」の真下に寄せる。
  const width = Math.min(MAX_WIDTH, Math.max(MIN_SIDE_WIDTH, area.right - area.left - EDGE * 2));
  const height = measureHeight(width);
  const left = clamp(anchor.left, area.left + EDGE, area.right - EDGE - width);
  const below = anchor.bottom + GAP;
  if (below + height <= viewport.height - EDGE) {
    return { side: 'below', left, width, top: below };
  }
  return { side: 'above', left, width, top: Math.max(EDGE, anchor.top - GAP - height) };
}
