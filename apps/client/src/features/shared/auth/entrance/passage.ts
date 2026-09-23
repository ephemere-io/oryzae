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
  return ENTRANCE_PATHS.includes(pathOf(destination));
}

/** 書斎のパス。 */
const STUDY_PATH = '/';

/**
 * その行き先が書斎そのものか。
 *
 * 書斎へ向かうときだけ、**扉の前から中まで 1 本のカメラが続く** — 同じシーンをそのまま
 * 次の画面へ渡すので、途中に切り替わりが無い（`study/scene/live.ts`）。
 * `/entries/new` のような別の画面へ向かうときは、扉をくぐった先が書斎ではないので
 * 続けようがない。そこは扉が開くところまでを見せて、溶暗で繋ぐ。
 */
export function entersStudy(destination: string): boolean {
  return pathOf(destination) === STUDY_PATH;
}

/** クエリとハッシュを落としたパス。 */
function pathOf(destination: string): string {
  return destination.split(/[?#]/, 1)[0] ?? destination;
}
