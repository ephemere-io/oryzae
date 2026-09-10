/**
 * 「組み直す必要があるか」を 1 本の文字列で言う（純関数）。
 *
 * 書斎の状態は 5 つの取得（未読・進み具合・受信箱・月別件数・記録・壁）を束ねたもので、
 * それぞれが別々に届く。届くたびに `StudyState` の同一性は変わるので、素直に受けると
 * **1 秒のあいだに 5 回、机も瓶も本も壁も作り直す**ことになる。1 回の作り直しは
 * ジオメトリとテクスチャの生成をひととおり含むので、そのフレームは必ず落ちる —
 * 戻ってきた直後に「一度止まってからカクカクっと動く」と報告されたのがこれ。
 *
 * しかも憶えてある書斎（`stale-cache`）を敷いているときは、あとから届く本物が
 * **前回と同じ内容**であることがほとんどで、作り直しの大半は絵を 1px も変えない。
 *
 * ここが見るのは `buildContent` が実際に読む 4 か所だけ:
 * `notebooks` / `now`（積みと棚）・`fermentation.readiness` と `.status`（瓶）・
 * `board.cards`（壁）。**`entries` や `questions` は絵に出ない**ので、一覧の取得が
 * 終わっただけで部屋が作り直されることはなくなる。
 */

import type { StudyState } from '../types';

/** 位置は 0.01 まで見る。これ以上細かい差は 3D の見た目に出ない。 */
function round(value: number): string {
  return (Math.round(value * 100) / 100).toString();
}

export function contentSignature(state: StudyState): string {
  const notebooks = state.notebooks
    .map((notebook) => `${notebook.month}:${notebook.entryCount}:${notebook.current ? 1 : 0}`)
    .join(',');

  const cards = state.board.cards
    .map((card) =>
      [
        card.id,
        card.cardType,
        round(card.x),
        round(card.y),
        round(card.rotation),
        round(card.width),
        round(card.height),
        card.zIndex,
        card.lines,
      ].join(':'),
    )
    .join(',');

  return [
    state.now,
    state.fermentation.status,
    round(state.fermentation.readiness),
    notebooks,
    cards,
  ].join('|');
}
