/**
 * 本文の中の一点（カーソルの行・写真）を、殻の本文（スクロール容器）の見えている範囲に入れる。
 *
 * 見えている範囲は**容器の CSS から読む**: 下端は `scroll-padding-bottom`（非モーダルのシートが
 * 覆っている高さ。殻が `--sp-dock-inset` で渡している）、上端は `scroll-padding-top`。余白は
 * 対象そのものの高さ（1 行ぶん）で、数を決め打ちしない。
 */

/** 縦にスクロールする指定を持つ、いちばん近い祖先（いまスクロールできる量が無くても返す）。 */
export function scrollContainerOf(el: Element): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const overflow = getComputedStyle(node).overflowY;
    if (overflow === 'auto' || overflow === 'scroll') return node;
    node = node.parentElement;
  }
  return null;
}

/** 縦にスクロールする、いちばん近い祖先（いまスクロールできる量があるもの）。無ければ null。 */
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

/** 容器の見えている範囲（画面座標）。`scroll-padding` の分を引く。 */
function visibleBand(container: HTMLElement): { top: number; bottom: number } {
  const style = getComputedStyle(container);
  const box = container.getBoundingClientRect();
  return {
    top: box.top + px(style.scrollPaddingTop),
    bottom: box.top + container.clientHeight - px(style.scrollPaddingBottom),
  };
}

/** `rect`（画面座標）が見えるように、`from` を含むスクロール容器を動かす。見えていれば何もしない。 */
export function revealRect(from: Element, rect: DOMRect): void {
  const container = scrollParent(from);
  if (!container) return;
  const band = visibleBand(container);
  const margin = rect.height;
  const top = band.top + margin;
  const bottom = band.bottom - margin;
  if (rect.top >= top && rect.bottom <= bottom) return;
  const delta = rect.bottom > bottom ? rect.bottom - bottom : rect.top - top;
  container.scrollBy({ top: delta });
}

/**
 * `rect` が見えている範囲の**真ん中より下**にあれば、真ん中まで送る（上にあるものは動かさない）。
 *
 * キーボードが出て本文の箱が縮んだ瞬間に使う。押した行が縮んだ箱の下のほう（キーボードの際や、その
 * 下）に残って、打ち始めるまで見えなかった（実機レビュー）。上のほうの行を押したときは既に見えて
 * いるので、景色を動かさない。送れる量が足りなければ（本文の末尾）行けるところまで。
 */
export function liftToMiddle(from: Element, rect: DOMRect): void {
  const container = scrollParent(from);
  if (!container) return;
  const band = visibleBand(container);
  const middle = (band.top + band.bottom) / 2;
  const center = rect.top + rect.height / 2;
  if (center <= middle) {
    if (rect.top < band.top) container.scrollBy({ top: rect.top - band.top });
    return;
  }
  container.scrollBy({ top: center - middle });
}
