'use client';

/**
 * 「いま扉から入ってきた」という印。認証画面（`features/shared/auth`）が立て、書斎が受け取る。
 *
 * 扉をくぐった先で書斎が**溶けて現れる**と、せっかく続いていた空間が一度白く飛んで切れる
 * （「ブツ切れ感がある」— PR #624 のレビュー）。受け取った側はフェードをやめ、代わりに
 * カメラが入り口から寄って止まる（`ARRIVAL`）。
 *
 * 置き場が `sessionStorage` なのは、**画面をまたぐ 1 回きりの合図**だから。認証の完了は
 * 全画面の読み込み直しを挟むので、React の状態では渡せない。タブを閉じたら忘れてよい。
 */

const KEY = 'oryzae_study_arrival';

/**
 * 受け取り済みの印を少しのあいだ憶えておく。
 *
 * 開発時の React は effect を 2 度走らせる（StrictMode）。1 度目で消してしまうと 2 度目が
 * 「入ってきていない」を読み、定置が出ないまま終わる。
 */
const REPLAY_MS = 5000;
let handedOver: number | null = null;

/** 書斎のパス。ここへ向かうときだけ印を立てる。 */
const STUDY_PATH = '/';

/** 行き先が書斎なら、扉をくぐった印を立てる。次に開く書斎がこれを読む。 */
export function markStudyArrivalFor(destination: string): void {
  if (destination !== STUDY_PATH) return;
  markStudyArrival();
}

function markStudyArrival(): void {
  try {
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // プライベートウィンドウ・容量超過。定置が出ないだけで、書斎はふつうに開く。
  }
}

/** 扉から入ってきたか。**読んだら消す**（次に書斎を開いたときは定置しない）。 */
export function takeStudyArrival(): boolean {
  if (typeof window === 'undefined') return false;
  if (handedOver !== null && Date.now() - handedOver < REPLAY_MS) return true;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw === null) return false;
    sessionStorage.removeItem(KEY);
    handedOver = Date.now();
    return true;
  } catch {
    return false;
  }
}
