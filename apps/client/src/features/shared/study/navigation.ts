/**
 * 書斎の対象から行き先を決める（`docs/oryzae-study/00-overview.md`「ナビゲーションの変更」）。
 *
 * 純関数。ルーティングそのものは呼び出し側（page）が持つ。
 */

import type { StudyTarget } from './types';

/**
 * 対象の行き先。
 *
 * `null` は「書斎の中で完結する」＝ URL を変えずに一覧オーバーレイを開く、という意味。
 * 手帳（どの月も）と棚がこれにあたる。
 *
 * **一覧を `/entries` に飛ばさないのは意図的。** 仕様上の一覧は「独立した画面」ではなく
 * 「手帳を開いた後のオーバーレイ」で、月で絞る・行を押すと本文が残る、という振る舞いを持つ。
 * これを `/entries` に持たせると既存の一覧画面を作り替えることになる（今回の変更は
 * ナビゲーションと入口だけ、という前提から外れる）。オーバーレイは書斎側が持つ。
 */
export function targetHref(target: StudyTarget): string | null {
  switch (target.kind) {
    case 'jar':
      return '/jar';
    case 'journal-new':
      return '/entries/new';
    case 'board':
      return '/board';
    case 'journal-month':
    case 'archive':
      return null;
  }
}

/** 書斎の中で完結する対象か（＝カメラは動くが URL は変わらない）。 */
export function staysInStudy(target: StudyTarget): boolean {
  return targetHref(target) === null;
}

/**
 * 一覧オーバーレイの絞り込み。`null` は全月。
 *
 * 手帳（当月を含む）はその月に、棚（SP は棚ごと 1 つの的）は全月に絞る。
 */
export function overlayScope(target: StudyTarget): { month: string | null } | null {
  if (target.kind === 'journal-month') return { month: target.month };
  if (target.kind === 'archive') return { month: null };
  return null;
}

/**
 * 手帳を押したときの対象。**どの冊もその月の一覧を開く**（当月も）。
 *
 * 以前は当月の冊だけが新規執筆へ飛んでいて、**今月の記録の一覧を見る方法が無かった**
 * （実機レビュー）。過去月の冊は一覧を開くのに、いちばん上の冊だけ振る舞いが違った。
 * 新しく書く入口は、鉛筆（`journal-new`）と一覧の「新規作成」の 2 つにある。
 */
export function notebookTarget(month: string): StudyTarget {
  return { kind: 'journal-month', month };
}
