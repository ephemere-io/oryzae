/**
 * 画面の座標から、そこにあたる文字の位置（キャレット）を取る。
 *
 * **API 名がブラウザで割れている。** Chromium / WebKit は `caretRangeFromPoint`、
 * Firefox は `caretPositionFromPoint`。TS の DOM 型は環境によって片方しか知らないので、
 * `document` 自体を型で絞らず、**関数がそこにあるかを実行時に確かめて**から呼ぶ。
 *
 * 落とした場所へ写真を運ぶために要る。ここが無いと、掴んで運んでも
 * 必ず「いまキャレットがある場所」に落ちてしまう。
 */

function readMethod(name: string): ((x: number, y: number) => unknown) | null {
  // Document は index signature を持たないので、いったん unknown を経由して読む
  // （`as` を使わずに「そこにあるか」を確かめるための遠回り）。
  const doc: unknown = document;
  if (typeof doc !== 'object' || doc === null || !(name in doc)) return null;
  const fn = Reflect.get(doc, name);
  return typeof fn === 'function' ? fn.bind(document) : null;
}

function isCaretPosition(value: unknown): value is { offsetNode: Node; offset: number } {
  if (typeof value !== 'object' || value === null) return false;
  if (!('offsetNode' in value) || !('offset' in value)) return false;
  return value.offsetNode instanceof Node && typeof value.offset === 'number';
}

/** 座標にあたるキャレット位置を Range で返す。取れなければ null。 */
export function caretRangeFromPoint(x: number, y: number): Range | null {
  const fromRange = readMethod('caretRangeFromPoint');
  if (fromRange) {
    const range = fromRange(x, y);
    return range instanceof Range ? range : null;
  }

  const fromPosition = readMethod('caretPositionFromPoint');
  if (fromPosition) {
    const pos = fromPosition(x, y);
    if (!isCaretPosition(pos)) return null;
    const range = document.createRange();
    range.setStart(pos.offsetNode, pos.offset);
    range.collapse(true);
    return range;
  }

  return null;
}
