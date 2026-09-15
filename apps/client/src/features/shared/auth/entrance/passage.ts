/**
 * 通り道の画面か。
 *
 * `/callback`（Google から戻った先）と `/auth/confirm`（メールのリンクの先）は、1 秒ほど
 * 扉の前に立って開くのを待つだけの場所で、何かを選ぶ場面ではない。
 *
 * **ここに言語の切り替えを出さない。** 以前はこの 2 画面にも認証レイアウトの言語選択が
 * そのまま載っていて、Google でログインした直後に「日本語」の選択欄だけがぽつんと浮く、
 * 誰も触る理由の無い画面になっていた（オーナーの報告）。
 */
export function isPassage(pathname: string): boolean {
  return pathname === '/callback' || pathname === '/auth/confirm';
}

/** 扉の手前にある画面（`app/(auth)` のルート）。 */
const ENTRANCE_PATHS = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/callback',
  '/auth/confirm',
];

/**
 * その行き先へ移るとき、扉の前に留まるか。
 *
 * メールのリンクには、パスワード再設定（`/reset-password`）のように**扉の手前へ戻る**
 * 行き先がある。そこで扉を開けて奥へ歩いてから同じ扉の前に戻ると、入ったのに
 * 追い返されたように見える。
 */
export function staysAtEntrance(destination: string): boolean {
  const path = destination.split(/[?#]/, 1)[0] ?? destination;
  return ENTRANCE_PATHS.includes(path);
}
