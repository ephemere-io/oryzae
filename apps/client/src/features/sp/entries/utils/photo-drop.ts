import { caretRangeFromPoint } from '@/features/shared/entries/utils/caret-from-point';

/**
 * 本文（contentEditable）の中の写真を、指で掴んで別の文字位置へ動かすための DOM の手続き。
 *
 * 落とす先は**文字の位置**（`caretRangeFromPoint`）。写真は文字 1 つぶんとして本文に入っているので
 * （PC と同じ保存形式）、動かす = その `<img>` をその位置へ入れ直す、で済む。
 */

/** 指の点に対応する、本文の中の文字の位置。本文の上端より上なら先頭、下端より下なら末尾。 */
export function dropRangeAt(editor: HTMLElement, x: number, y: number): Range | null {
  const box = editor.getBoundingClientRect();
  if (y < box.top) return edgeRange(editor, true);
  if (y > box.bottom) return edgeRange(editor, false);
  const range = caretRangeFromPoint(x, y);
  if (!range || !editor.contains(range.startContainer)) return null;
  return range;
}

function edgeRange(editor: HTMLElement, start: boolean): Range {
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(start);
  return range;
}

/** 文字の位置が、この写真のすぐ前かすぐ後か（そこへ落としても位置は変わらない）。 */
function touches(range: Range, node: Node): boolean {
  const parent = node.parentNode;
  if (!parent) return false;
  const { startContainer: container, startOffset: offset } = range;
  if (container === parent) {
    let index = 0;
    for (let child = parent.firstChild; child && child !== node; child = child.nextSibling) index++;
    return offset === index || offset === index + 1;
  }
  if (container instanceof Text && container === node.previousSibling) {
    return offset === container.length;
  }
  if (container instanceof Text && container === node.nextSibling) return offset === 0;
  return false;
}

/** 写真をその文字の位置へ入れ直す。位置が変わらなければ何もせず false。 */
export function movePhotoTo(photo: HTMLElement, range: Range): boolean {
  if (touches(range, photo)) return false;
  const host = range.commonAncestorContainer;
  range.insertNode(photo);
  // 入れ直しで割れた文字の節を繋ぎ直す（数え方は変わらないが、次の位置の計算を素直にする）。
  (host instanceof Text ? host.parentNode : host)?.normalize();
  return true;
}

/**
 * 文字の位置の、画面上の縦線（幅 0 の矩形）。落とす先の印を置くのに使う。
 *
 * 畳んだ Range は、要素の境目（写真の前後・空の行）で矩形を返さないことがある。そのときは
 * 隣の文字か隣の要素の縁で測る。折り返しの境目では同じ位置が「前の行の末尾」と「次の行の頭」の
 * 2 か所に描けるので、`nearY`（指の高さ）を含む行の方を選ぶ。
 */
export function caretRect(range: Range, nearY?: number): DOMRect | null {
  // 配置を計算しない環境（jsdom）には測る手段が無い。
  if (typeof range.getClientRects !== 'function') return null;
  const { startContainer: container, startOffset: offset } = range;
  const candidates: DOMRect[] = [];
  for (const rect of range.getClientRects()) {
    if (rect.height > 0) candidates.push(new DOMRect(rect.left, rect.top, 0, rect.height));
  }
  if (container instanceof Text) {
    const edge = textEdge(container, offset);
    if (edge) candidates.push(edge);
  } else {
    const after = container.childNodes[offset];
    const before = container.childNodes[offset - 1];
    const edge =
      after instanceof Text
        ? textEdge(after, 0)
        : before instanceof Text
          ? textEdge(before, before.length)
          : elementEdge(after ?? before, Boolean(after));
    if (edge) candidates.push(edge);
  }
  if (nearY !== undefined) {
    const onRow = candidates.find((rect) => nearY >= rect.top && nearY <= rect.bottom);
    if (onRow) return onRow;
  }
  return candidates[0] ?? null;
}

function elementEdge(node: Node | undefined, leading: boolean): DOMRect | null {
  if (!(node instanceof Element)) return null;
  const rect = node.getBoundingClientRect();
  if (rect.height === 0) return null;
  return new DOMRect(leading ? rect.left : rect.right, rect.top, 0, rect.height);
}

/** 文字の節の `offset` の縁（前の文字の右端か、次の文字の左端）。 */
function textEdge(text: Text, offset: number): DOMRect | null {
  if (text.length === 0) return null;
  const at = Math.min(offset, text.length - 1);
  const probe = document.createRange();
  probe.setStart(text, at);
  probe.setEnd(text, at + 1);
  const rect = probe.getBoundingClientRect();
  if (rect.height === 0) return null;
  return new DOMRect(offset >= text.length ? rect.right : rect.left, rect.top, 0, rect.height);
}
