/**
 * 写真をドラッグしているとき「いまここで放すとどこに入るか」を決める。
 *
 * Word の画像ドラッグと同じ考え方にしてある。**座標に置くのではなく、本文のキャレット位置に
 * 差し込む**。ドラッグ中は落ちる先のキャレットを線で示し、放すとそこへ移る。座標で絶対配置
 * すると、そのあと本文を編集したときに写真だけ取り残される。
 *
 * ここを純粋関数に切り出してあるのは、pointer イベントの中に埋めると誰も検証できなく
 * なるため。DOM は渡してもらい、イベントは扱わない。
 */

export interface DropTarget {
  /** 差し込み先のノードと、その中での位置。 */
  node: Node;
  offset: number;
  /** キャレットの見た目の矩形（画面座標）。落ちる先を線で示すのに使う。 */
  rect: DOMRect;
}

/**
 * 画面座標から差し込み先を求める。
 *
 * @param editor 本文の要素。ここの外に落ちた場合は差し込まない。
 * @param dragged いま運んでいる写真。自分自身の中には落とせない。
 */
export function findDropTarget(
  editor: HTMLElement,
  dragged: HTMLElement,
  clientX: number,
  clientY: number,
): DropTarget | null {
  const caret = caretFromPoint(clientX, clientY);
  if (!caret) return null;

  // 本文の外（ツールバー等）に出たら差し込み先なし。線も消える。
  if (!editor.contains(caret.node)) return null;
  // 自分自身の中に落とすと入れ子になる。
  if (dragged.contains(caret.node)) return null;

  const rect = caretRect(caret.node, caret.offset);
  if (!rect) return null;

  return { node: caret.node, offset: caret.offset, rect };
}

/**
 * 差し込み先へ実際に移す。
 *
 * @returns 位置が変わったら true。変わらなければ false（無駄な保存をしない）。
 */
export function applyDrop(dragged: HTMLElement, target: DropTarget): boolean {
  // **動かす前に**同じ場所かを見る。移動してから前後を比べる方式だと、テキストの分割で
  // 空のノードが生まれて「位置が変わった」と誤判定し、動いていないのに保存が走る。
  if (isSamePosition(dragged, target)) return false;

  if (target.node instanceof Text) {
    const parent = target.node.parentNode;
    if (!parent) return false;
    // 途中に落ちたときだけ分割する。端で分割すると空のテキストノードが残る。
    const atEnd = target.offset >= target.node.length;
    const after = atEnd
      ? target.node.nextSibling
      : target.offset > 0
        ? target.node.splitText(target.offset)
        : target.node;
    parent.insertBefore(dragged, after);
  } else {
    target.node.insertBefore(dragged, target.node.childNodes[target.offset] ?? null);
  }

  return true;
}

/** 落とし先が、いま居る場所と同じか。 */
function isSamePosition(dragged: HTMLElement, target: DropTarget): boolean {
  if (target.node instanceof Text) {
    // テキストの末尾に落とす ＝ その直後。先頭に落とす ＝ その直前。
    if (target.offset >= target.node.length) return target.node.nextSibling === dragged;
    if (target.offset === 0) return target.node.previousSibling === dragged;
    return false;
  }
  const children = target.node.childNodes;
  return children[target.offset] === dragged || children[target.offset - 1] === dragged;
}

/**
 * キャレット位置の矩形。書字方向に依らず**そのまま線として使える**のが要点で、
 * 横書きなら縦長（縦棒）、縦書きなら横長（横棒）の矩形が返る。
 */
function caretRect(node: Node, offset: number): DOMRect | null {
  const range = document.createRange();
  try {
    range.setStart(node, offset);
    range.collapse(true);
  } catch {
    return null; // offset が範囲外（DOM が動いた直後など）。
  }

  const rect = range.getBoundingClientRect();
  // 空行など、潰れた矩形しか取れないことがある。その場合は行の高さを親から借りる。
  if (rect.width === 0 && rect.height === 0) {
    const host = node instanceof Element ? node : node.parentElement;
    return host?.getBoundingClientRect() ?? null;
  }
  return rect;
}

interface CaretPoint {
  node: Node;
  offset: number;
}

/**
 * 画面座標のキャレット位置。標準（`caretPositionFromPoint`）と WebKit/Blink
 * （`caretRangeFromPoint`）の両方を見る。どちらも無ければ null。
 */
function caretFromPoint(x: number, y: number): CaretPoint | null {
  const doc: Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  } = document;

  const position = doc.caretPositionFromPoint?.(x, y);
  if (position) return { node: position.offsetNode, offset: position.offset };

  const range = doc.caretRangeFromPoint?.(x, y);
  if (range) return { node: range.startContainer, offset: range.startOffset };

  return null;
}
