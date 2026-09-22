/**
 * ホバーで出す一言の文面（`docs/oryzae-study/00-overview.md`「対象ラベルとホバー」）。
 *
 * ラベルは**名前しか言わない**（`BOARD`）。それだけでは中に何が貼ってあるか開くまで
 * 分からず、実機レビューで「ボードにホバーしても何も出ない」と報告された。手帳と
 * 背表紙は月ごとの `StudyTooltip` を別に持っているので、ここは持たない的だけを扱う。
 *
 * i18n の鍵と差し込む数を返すだけの純関数。描くのは `StudyHintTooltip`。
 */

import type { HitHint } from './scene/hit-targets';
import type { StudyState } from './types';

export interface StudyHint {
  /** `study` 配下の鍵。 */
  textKey: string;
  /** ICU に差し込む数。数を持たない鍵もある。 */
  values?: Record<string, number>;
}

/** 触れている的に応じた一言。 */
export function studyHint(hint: HitHint, state: StudyState): StudyHint {
  switch (hint) {
    case 'pen':
      return { textKey: 'hint_pen' };
    case 'jar':
      return { textKey: jarHintKey(state) };
    case 'board':
      return boardHint(state);
  }
}

/**
 * 瓶の一言。**届いている手紙を最優先で言う。**
 *
 * 瓶は溜まり具合を液面で見せているが、「手紙が届いた」ことだけは見た目では言えない
 * （泡が静まるだけ）。ラベルの状態語（`pill_jar_*`）と同じ段階分けにしつつ、
 * 未読があるときはそれを先に言う。
 *
 * 読み終えた手紙しか無いときは「手紙を読み返せます」。「読んだ手紙が入っています」は
 * 状態の報告にとどまっていて、押すと何が起きるのかを言っていなかった（実機レビューで
 * 差し替えを求められた）。件数は出さない — 受信箱は問いごとに最新 1 通しか持たず、
 * 数えると実際に届いた通数より少なく名乗ってしまう。
 */
function jarHintKey(state: StudyState): string {
  if (state.unreadCount > 0) return 'hint_jar_letter';
  const { status, readiness } = state.fermentation;
  if (status === 'completed') return 'hint_jar_read';
  if (status === 'idle') return 'hint_jar_empty';
  return readiness >= 0.9 ? 'hint_jar_almost' : 'hint_jar_fermenting';
}

/**
 * 板の一言。**内訳で言う。**
 *
 * 総数だけだと「12 枚」としか言えない。0 の種類は読み上げない — 「写真 0 件・
 * スニペット 12 件」は、無いものをわざわざ数える文になる。
 */
function boardHint(state: StudyState): StudyHint {
  const { photos, snippets } = state.board;
  if (photos > 0 && snippets > 0) {
    return { textKey: 'hint_board_both', values: { photos, snippets } };
  }
  if (photos > 0) return { textKey: 'hint_board_photos', values: { count: photos } };
  if (snippets > 0) return { textKey: 'hint_board_snippets', values: { count: snippets } };
  return { textKey: 'hint_board_empty' };
}
