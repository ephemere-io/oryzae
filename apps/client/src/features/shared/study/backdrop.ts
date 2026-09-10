'use client';

/**
 * 出ていく直前の書斎を 1 枚だけ憶えておく置き場。
 *
 * **書斎とサブ画面は別々の画面ではなく、1 つの空間の遠近**という見立てを保つための地。
 * 寄って入り、引いて出る、という体験にしたとき、サブ画面に居る間だけ部屋が「無かった
 * こと」になるのは嘘になる。かといって 3D を裏で回し続けるのは高い（WebGL の
 * コンテキストは数えるほどしか持てず、GPU も電池も食う）ので、**静止画に畳んで持つ**。
 *
 * `sessionStorage` に置くのは、タブを閉じたら忘れてよいものだから。`localStorage` だと
 * 昨日の部屋が今日の地になり、記録が変わっているのに絵だけ古い、という食い違いが出る。
 *
 * 保存できなくても（プライベートウィンドウ・容量超過）**何も壊さない**。地が無いだけで
 * 遷移も戻り道も成立する。
 */

const KEY = 'oryzae_study_backdrop';

/** 憶える。失敗しても黙って諦める（地は無くても成立する）。 */
export function saveStudyBackdrop(dataUrl: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(KEY, dataUrl);
  } catch {
    // 容量超過・保存できない環境。地を敷かないだけ。
  }
}

/**
 * 憶えた 1 枚。無ければ null。
 *
 * **中身が data URL であることまで見る。** 別のものが同じ鍵に入っていた場合に
 * `<img src>` へそのまま渡すと、壊れた画像のアイコンが地に出る。
 */
export function readStudyBackdrop(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.sessionStorage.getItem(KEY);
    if (value === null || !value.startsWith('data:image/')) return null;
    return value;
  } catch {
    return null;
  }
}
