/**
 * textarea のカーソルの行を、殻の本文（スクロール容器）の見えている範囲に入れる。
 *
 * ブラウザの「入力欄を見せるスクロール」は入力欄の箱を見せるだけで、箱が長いとカーソルの行は
 * 見えないことがある（写真の直後の文にフォーカスすると、写真だけがキーボードの上に残った）。
 * カーソルの行の位置は、同じ書体・同じ幅の**鏡**（隠した div）にカーソルまでの文字を写して測る。
 */

/** 見えている範囲の上下に残す余白（px）。 */
const MARGIN = 24;

let mirror: HTMLDivElement | null = null;

const COPIED_STYLES = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'letterSpacing',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderLeftWidth',
  'borderRightWidth',
  'boxSizing',
  'textIndent',
  'wordBreak',
  'overflowWrap',
] as const;

/** カーソルの行の、textarea の上端からの位置と行の高さ（px）。 */
function caretLineRect(el: HTMLTextAreaElement): { top: number; height: number } {
  if (typeof document === 'undefined') return { top: 0, height: 0 };
  if (!mirror) {
    mirror = document.createElement('div');
    mirror.setAttribute('aria-hidden', 'true');
    mirror.style.position = 'absolute';
    mirror.style.top = '0';
    mirror.style.left = '-99999px';
    mirror.style.visibility = 'hidden';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.pointerEvents = 'none';
    document.body.appendChild(mirror);
  }
  const style = getComputedStyle(el);
  for (const key of COPIED_STYLES) mirror.style[key] = style[key];
  mirror.style.width = `${el.clientWidth}px`;
  const caret = el.selectionStart ?? el.value.length;
  mirror.textContent = el.value.slice(0, caret);
  const marker = document.createElement('span');
  marker.textContent = '​';
  mirror.appendChild(marker);
  const lineHeight = Number.parseFloat(style.lineHeight) || marker.offsetHeight || 24;
  return { top: marker.offsetTop, height: marker.offsetHeight || lineHeight };
}

/** 縦にスクロールする、いちばん近い祖先。無ければ null。 */
function scrollParent(el: HTMLElement): HTMLElement | null {
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

/**
 * カーソルの行が見えるように、スクロール容器を動かす。既に見えていれば何もしない。
 * 容器の下端は、板（ドック）や下端の列の上端に一致している前提（殻の流れの中）。
 */
export function scrollCaretIntoView(el: HTMLTextAreaElement): void {
  const container = scrollParent(el);
  if (!container) return;
  const { top, height } = caretLineRect(el);
  const containerRect = container.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  // 容器の内容座標での、カーソルの行の上端。
  const lineTop = elRect.top - containerRect.top + container.scrollTop + top;
  const lineBottom = lineTop + height;
  const viewTop = container.scrollTop + MARGIN;
  const viewBottom = container.scrollTop + container.clientHeight - MARGIN;
  if (lineTop >= viewTop && lineBottom <= viewBottom) return;
  if (lineBottom > viewBottom) {
    container.scrollTop = lineBottom - container.clientHeight + MARGIN;
  } else {
    container.scrollTop = Math.max(0, lineTop - MARGIN);
  }
}
