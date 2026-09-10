'use client';

import { useStudyHome } from './use-study-home-flag';

/**
 * ログイン後の行き先（＝このアプリの「ホーム」）。
 *
 * 書斎ホームが有効なら `/study`、そうでなければ `/entries/new`。**この判断を持つ場所は
 * ここ 1 つ**にする。以前は `HomeGate` だけがフラグを見て、ログインフォームは
 * `/entries/new` を直書きしていた。その結果 `?study=on` を付けてプレビューを開いても、
 * 未ログイン → `/login` → ログイン → 従来の入口、となって書斎に入れなかった
 * （プレビューは本番と別オリジンなので、確認する人は必ずこの動線を通る）。
 *
 * React の外で行き先を決める場所（OAuth の全画面遷移・メールリンクの既定 next）は、
 * この hook を持ち回る代わりに **`/` へ送る**。`/` は `HomeGate` ＝ この hook を使う
 * 唯一の描画なので、同じ規則が同じ 1 か所から効く。
 */
// 型は export しない（`types-live-in-types-file`: hooks/ から型を出さない）。
// 呼び出し側はこの形を名前で受け取る必要が無い。
interface HomeHref {
  /** 送り先のパス。 */
  href: string;
  /** 手動切替を読み終えたか。false の間はこの href で遷移しないこと。 */
  resolved: boolean;
}

export function useHomeHref(): HomeHref {
  const { enabled, resolved } = useStudyHome();
  return { href: enabled ? '/study' : '/entries/new', resolved };
}
