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
 * 過去月の手帳と棚がこれにあたる。
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
    case 'memo':
      return null;
  }
}

/**
 * ヘルプ（使い方の面）を開閉する対象か。
 *
 * メモ帳はヘルプの入口。押すと画面を移さず、右の面（SP は下のシート）が開く。
 * 以前は公開サイトの `/support` を新しいタブで開いていたが、ヘルプがアプリの中に
 * 入ったので、部屋を出ずに済む。公開サイトへは面の中の「困ったとき」から。
 */
export function opensHelp(target: StudyTarget): boolean {
  return target.kind === 'memo';
}

/**
 * 書斎の中で一覧を開いて完結する対象か（＝URL は変わらない）。
 *
 * メモ帳も URL を変えないが一覧は開かない（ヘルプを開く）。`targetHref === null` で判定すると
 * メモ帳を押したときに一覧が開いてしまう。
 */
export function staysInStudy(target: StudyTarget): boolean {
  return target.kind === 'journal-month' || target.kind === 'archive';
}

/**
 * カメラを動かさずに移る対象か。
 *
 * メモ帳は瓶や板のような「場所」ではなく文房具なので、寄っていく芝居を挟まない。
 * アバターと同じく、そのまま画面を移す。
 */
export function movesWithoutCamera(target: StudyTarget): boolean {
  return target.kind === 'memo';
}

/**
 * 一覧オーバーレイの絞り込み。`null` は全月。
 *
 * 過去月の手帳はその月に、棚（SP は棚ごと 1 つの的）は全月に絞る。
 */
export function overlayScope(target: StudyTarget): { month: string | null } | null {
  if (target.kind === 'journal-month') return { month: target.month };
  if (target.kind === 'archive') return { month: null };
  return null;
}

/**
 * 手帳を押したときの対象。**当月（積みのいちばん上）は新規執筆、過去月はその月の一覧。**
 *
 * 一度、当月の冊も一覧を開くようにした（「今月の一覧を見る方法が無い」）が、オーナーの
 * 判断で新規執筆に戻した — いちばん上の冊はいま書いている冊で、開くことは書くこと。
 * 今月の一覧は、一覧の月のチップ（過去の冊・棚から開く）で選べる。一覧の「新規作成」も残す。
 *
 * **カメラが動く前にこれを決める。** entry 層のフェードイン（0.8s）と本文の切替（0.4s）が
 * 重なると、新規執筆に入る直前に前の記録が一瞬見えてしまう。
 */
export function notebookTarget(month: string, isCurrent: boolean): StudyTarget {
  return isCurrent ? { kind: 'journal-new' } : { kind: 'journal-month', month };
}
