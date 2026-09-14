/**
 * 本文の中の一点（カーソルの行・写真）を、殻の本文（スクロール容器）の見えている範囲に入れる。
 *
 * 見えている範囲は**容器の CSS から読む**: 下端は `scroll-padding-bottom`（非モーダルのシートが
 * 覆っている高さ。殻が `--sp-dock-inset` で渡している）、上端は `scroll-padding-top`。余白は
 * 対象そのものの高さ（1 行ぶん）で、数を決め打ちしない。
 */

/** 縦にスクロールする、いちばん近い祖先。無ければ null。 */
export function scrollParent(el: Element): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const overflow = getComputedStyle(node).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

function px(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/** `rect`（画面座標）が見えるように、`from` を含むスクロール容器を動かす。見えていれば何もしない。 */
export function revealRect(from: Element, rect: DOMRect): void {
  const container = scrollParent(from);
  if (!container) return;
  const style = getComputedStyle(container);
  const box = container.getBoundingClientRect();
  const margin = rect.height;
  const top = box.top + px(style.scrollPaddingTop) + margin;
  const bottom = box.top + container.clientHeight - px(style.scrollPaddingBottom) - margin;
  if (rect.top >= top && rect.bottom <= bottom) return;
  const delta = rect.bottom > bottom ? rect.bottom - bottom : rect.top - top;
  container.scrollBy({ top: delta });
}
