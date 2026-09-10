'use client';

import { RouteLoading } from '../_loading/route-loading';

/**
 * `/entries` とその配下の遷移ローディング。
 *
 * ルートごとに `loading.tsx` を置くことで、Next が**行き先のセグメントの枠**を出す
 * （ルートグループに1枚だけ置くと、どの画面へ移動しても同じ枠＝一覧の枠が出てしまう。
 * それが「/jar でも一覧のスケルトンが出る」原因だった）。
 *
 * **ただしここは親の境界でもある。** `/entries/new` や `/entries/[id]` へ移ると
 * `entries` セグメントも新しく作られるので、子の枠より先にこの枠が出る。素直に一覧の枠を
 * 描くと、エディタへ移ったのに一覧のスケルトンが一瞬映る（書斎から手帳を開いたときに
 * 実際そう見えていた）。そこで**行き先のパスから引いた枠**を出す。
 * 子の `loading.tsx` は同じものを直接描くので、親から子へ移っても絵が変わらない。
 */
export default function Loading() {
  return <RouteLoading />;
}
