/**
 * 書斎の対象から行き先を決める（`docs/oryzae-study/00-overview.md`「ナビゲーションの変更」）。
 *
 * 純関数。ルーティングそのものは呼び出し側（page）が持つ。
 */

import { docsHref } from '@/lib/docs-site';
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
 * 部屋の外（公開サイト、別ドメイン）の行き先。無ければ null。
 *
 * メモ帳は物。押すと公開サイトのヘルプ（使い方・よくある質問・お問い合わせを 1 枚に
 * まとめた `/support`）を新しいタブで開く。**ヘルプモードの開閉には使わない** — 一度
 * メモ帳で面を開閉する形にしたが、物を押してモードが切り替わるのは戻り道が読めない
 * （「メモというよりヘルプモードという体験」）。モードの入口は画面の右上の「?」。
 * `locale` はアプリの現在の言語（公開サイトへ `?lang=` で渡す）。
 */
export function externalHref(target: StudyTarget, locale?: string): string | null {
  return target.kind === 'memo' ? docsHref('/support', locale) : null;
}

/**
 * 書斎の中で一覧を開いて完結する対象か（＝URL は変わらない）。
 *
 * メモ帳も URL を変えないが一覧は開かない（外へ出る）。`targetHref === null` で判定すると
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
