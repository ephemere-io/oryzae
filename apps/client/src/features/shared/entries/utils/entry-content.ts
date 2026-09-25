import { type EditorEffectsState, INLINE_IMAGE_PLACEHOLDER } from '@oryzae/shared';

/**
 * 保存された `content` を、エディタの**題と本文**に分ける（PC・SP 共通）。
 *
 * ### 保存形式のあいまいさ
 *
 * `content` は「題があれば `題\n本文`、無ければ `本文` だけ」で保存される（PC・SP とも同じ）。
 * 読むときは 1 行目を題と見なす約束だが、**題を付けずに保存された本文**を読むと、本文の 1 行目が
 * 題に繰り上がる。文字だけならそれで困らない（題の無い記録は 1 行目を題として扱う、という設計）。
 *
 * 困るのは**写真**。本文の中の写真の位置（`effects.inlineImages[].offset`）は、保存したときの
 * **エディタの本文の頭から**数えてある。題を付けずに保存したなら頭は `content` の頭で、1 行目を
 * 題として切り離すと、全部の写真の位置が「1 行目の長さ + 1」だけずれる。ずれた位置には
 * プレースホルダ（U+FFFC）が無いので、写真は本文から外れる。SP ではそれが末尾の「添えた写真」に
 * 落ち、そのまま保存すると写真の位置を持たない effects で上書きしていた（実機レビュー #616:
 * 「PC で本文の間に貼った写真が SP で末尾に移され、PC で開き直すと表示されなくなった」）。
 *
 * ### 決め方
 *
 * 写真の位置は**確かめられる目印**（そこに U+FFFC がある）なので、それで数え方を決める:
 *
 * 1. 1 行目にプレースホルダがある → **題ではない**（題は文字だけの入力欄で、写真は入らない）
 * 2. 写真の位置が「1 行目を切り離した本文」でより多く当たる → 題あり（これまでどおり）
 * 3. 「`content` 全体」でより多く当たる → 題を付けずに保存された本文。題は空、本文は全体
 * 4. どちらとも決まらない（写真が無い等） → これまでどおり 1 行目を題に
 *
 * 保存し直すときは題が空なので `content = 本文` のまま＝**読んだ形と同じ形で書き戻る**。
 */
export function splitEntryContent(
  content: string,
  effects: EditorEffectsState | null | undefined,
): { title: string; body: string } {
  const newline = content.indexOf('\n');
  if (newline === -1) return { title: '', body: content };

  const firstLine = content.slice(0, newline);
  if (firstLine.includes(INLINE_IMAGE_PLACEHOLDER)) return { title: '', body: content };

  const titled = { title: firstLine, body: content.slice(newline + 1) };
  const images = effects?.inlineImages ?? [];
  if (images.length === 0) return titled;

  const hits = (text: string) =>
    images.filter((image) => text[image.offset] === INLINE_IMAGE_PLACEHOLDER).length;
  return hits(content) > hits(titled.body) ? { title: '', body: content } : titled;
}
