/**
 * `<textPath>` の字が経路から落ちていないかを見る invariant。
 *
 * SVG は**経路の外へ出た字を描かない**。DOM に文字列は入っているので
 * `textContent` を見る検証はすべて通るのに、画面では頭や尻が黙って欠ける。
 *
 * 実際に起きた壊れ方（SP の瓶の問い）:
 * 経路の頭を 9 時に置き `startOffset="25%"` + `textAnchor="middle"` にしていたため、
 * 12 時を中心に伸びた字が経路の頭より手前へ出て、直径 172px の円で
 * 「自然環境を身に宿すためのデザインとは？」の頭 3 字が消えていた。
 * 字数の計算は通っていた。**描かれたかどうかは、測らないと分からない**。
 *
 * jsdom には版組みが無く `getComputedTextLength` / `getTotalLength` を持たないので、
 * そこでは黙って通る（ブラウザの /verify dashboard でだけ効く）。
 *
 * 配置が lib/ なのは dep-cruise の lib-independence に適合するため
 * （features/*.verify.tsx から lib/ は import 可。逆は不可）。
 */

import type { Invariant } from '@oryzae/verify';

interface CharBox {
  width: number;
  height: number;
}

interface Measurable {
  getNumberOfChars: () => number;
  getExtentOfChar: (index: number) => CharBox;
}

/**
 * 落ちた字を測れるか。
 *
 * `getComputedTextLength()` では**判定できない**。あれは描かれたかに関係なく
 * 送り幅の合計を返すので、経路から落ちた字も長さに数えられてしまう。
 * 1 字ずつ外接矩形を見て、幅も高さも 0 なら「描かれていない」。
 */
function isMeasurable(node: unknown): node is Element & Measurable {
  return (
    node instanceof Element &&
    'getExtentOfChar' in node &&
    typeof node.getExtentOfChar === 'function' &&
    'getNumberOfChars' in node &&
    typeof node.getNumberOfChars === 'function'
  );
}

/** 経路から落ちて描かれていない字の報告。空なら全部描けている。 */
function dropped(root: ParentNode): string[] {
  const reports: string[] = [];

  for (const textPath of root.querySelectorAll('textPath')) {
    const text = textPath.parentElement;
    if (!isMeasurable(text)) continue;

    const total = text.getNumberOfChars();
    let missing = 0;
    for (let i = 0; i < total; i += 1) {
      const box = text.getExtentOfChar(i);
      if (box.width === 0 && box.height === 0) missing += 1;
    }
    if (missing > 0) {
      const label = textPath.textContent ?? '';
      reports.push(`「${label.slice(0, 10)}…」の ${missing}/${total} 字が描かれていない`);
    }
  }

  return reports;
}

export function textPathFitsInvariant<P>(): Invariant<P> {
  return {
    id: 'every-glyph-is-drawn',
    description:
      '経路に載せた字が 1 つも落ちていない（数えて入っていても、描かれなければ読めない）',
    check: ({ root }) => {
      const reports = dropped(root);
      return reports.length === 0 || reports.join(' / ');
    },
  };
}
