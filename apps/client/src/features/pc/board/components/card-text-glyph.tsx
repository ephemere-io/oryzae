'use client';

import { verifyAttrs } from '@oryzae/verify';

/**
 * 引ききった倍率（`detail === 'block'`）で、本文の代わりに置く「文字があるしるし」。
 *
 * 以前はこの倍率で文字を描くのをやめ、**カードを空白のまま**にしていた。
 * 読めない文字を枚数分描くのは無駄だが、空白にすると「中身が無いカード」と
 * 見分けが付かない（PR #533 のレビュー指摘）。行の並びだけを図として残せば、
 * 描画量は増やさずに「ここには文章がある」ことが伝わる。
 *
 * 実際の文字数には連動させない。この倍率では 1 行が 1〜2px にしかならず、
 * 行数を正確にしても読み取れないため、段落らしい見えだけを作る。
 *
 * 使うのはスニペットだけ。以前はエントリのカードにも見出し行付きで出していたが、
 * PR #524 でエントリのカード種別そのものが無くなった。
 *
 * 色は **必ず `--fg`**（本文と同じインク）にする。最初は明色前提の濃いグレーを
 * ベタ書きしていたため、ダークモードでは白い本文が薄いグレーの線に入れ替わり
 * 「消えた？」と見えた（PR #533 のレビュー指摘）。暗い地は明るい線の見え方が
 * 弱くなるので、不透明度だけ dark 側で上げる。
 */

/** 本文行の幅（%）。最終行を短くして段落の終わりに見せる。 */
const BODY_LINES = [
  { id: 'l1', width: 100 },
  { id: 'l2', width: 94 },
  { id: 'l3', width: 98 },
  { id: 'l4', width: 62 },
];

export function CardTextGlyph() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none flex h-full flex-col justify-center gap-[6px] p-6"
      {...verifyAttrs({
        unit: 'CardTextGlyph',
        lineCount: BODY_LINES.length,
      })}
    >
      {BODY_LINES.map((line) => (
        <div
          key={line.id}
          data-verify-part="glyph-line"
          className="rounded-[1px] bg-[var(--fg)] opacity-[0.18] dark:opacity-[0.3]"
          style={{ width: `${line.width}%`, height: 6 }}
        />
      ))}
    </div>
  );
}
