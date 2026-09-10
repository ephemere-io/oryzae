/**
 * 画面上の座標にあるキャレット位置（Range）を返す。
 *
 * 「落とした場所に入れる」ために要るのだが、**この API はブラウザで名前が割れている**:
 * Chromium / WebKit は `caretRangeFromPoint`（非標準だが広く実装されている）、
 * Firefox は標準の `caretPositionFromPoint`（Range ではなく node + offset を返す）。
 * 片方だけを見ていると、もう片方では落とした位置が無視されて直前のキャレットに入る。
 *
 * どちらも無い環境（jsdom など）では null を返す。呼び出し側は「位置が取れなければ
 * いまのキャレットのまま」に倒すこと。
 */
export function caretRangeFromPoint(x: number, y: number): Range | null {
  if (typeof document === 'undefined') return null;

  const fromRange = document.caretRangeFromPoint?.(x, y);
  if (fromRange) return fromRange;

  const position = document.caretPositionFromPoint?.(x, y);
  if (!position) return null;

  const range = document.createRange();
  range.setStart(position.offsetNode, position.offset);
  range.collapse(true);
  return range;
}
