/**
 * 記録のエンドポイントが受け取るクエリ値の読み取り。
 *
 * ルート本体から切り出しているのは、値の妥当性判断がそれ自体でテストに値するため
 * （board/presentation/params.ts と同じ判断）。
 */

/** ±14 時間。実在するタイムゾーンの上限（Kiribati の +14）。 */
const MAX_TZ_OFFSET_MINUTES = 14 * 60;

/**
 * `Date.prototype.getTimezoneOffset()` 相当の分数を受ける（UTC − ローカル。JST は -540）。
 *
 * 未指定・非数値・実在しない範囲は 0（＝UTC 基準）に落とす。月の境界がずれるだけで
 * 集計そのものは成立するので、入口で弾いて 400 を返すより既定に倒すほうがよい。
 *
 * 正規表現で形を縛るのは `Number.parseInt` が `"-540abc"` を -540 として通すため
 * （board/presentation/params.ts が同じ理由で同じことをしている）。
 */
export function parseTzOffsetMinutes(raw: string | undefined): number {
  if (typeof raw !== 'string') return 0;
  const trimmed = raw.trim();
  if (!/^-?\d{1,4}$/.test(trimmed)) return 0;
  const value = Number.parseInt(trimmed, 10);
  return Math.abs(value) <= MAX_TZ_OFFSET_MINUTES ? value : 0;
}

/**
 * 一覧を絞る `YYYY-MM`。書斎の手帳・棚がその月の記録を引くのに使う。
 *
 * 形が違えば `undefined`（＝絞らない）。ここで 400 にしないのは、月の指定は
 * 一覧の**任意の絞り込み**であって、成立に必須の引数ではないため。
 * 月は 01〜12 のみ受ける（`2026-13` を通すと空の区間で必ず 0 件になり、
 * 「その月には無い」と区別がつかない）。
 */
export function parseMonth(raw: string | undefined): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(trimmed)) return undefined;
  return trimmed;
}
