'use client';

/**
 * 卓上のメモをはがしたかどうかの置き場。
 *
 * メモは「初めて来た人の机に 1 枚だけ置いてある」もので、はがしたら二度と戻らない。
 * 憶えるのは端末（`localStorage`）— アカウントの設定にするほどの重さは無く、別の端末で
 * もう一度目にしても「その机にも置いてあった」で済む。
 *
 * 保存できなくても（プライベートウィンドウ）**何も壊さない**。次に開いたときにまた
 * 置いてあるだけで、はがす操作そのものは成立する。
 */

const KEY = 'oryzae_study_note_dismissed';

/** はがした。失敗しても黙って諦める。 */
export function saveStudyNoteDismissed(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, '1');
  } catch {
    // 保存できない環境。次に開いたときにまた置いてあるだけ。
  }
}

/** はがしてあるか。読めない環境では「置いてある」に倒す。 */
export function readStudyNoteDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}
