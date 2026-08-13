/**
 * 日付整形の基盤ユーティリティ（端末・ドメイン非依存）。
 *
 * Issue #490: 同じ整形が SP 一覧・SP 瓶・PC ボードに個別実装されていた（reach をまたぐと
 * 共有できないため各自で書いていた）。表示フォーマットごとに1関数へ集約する。
 * 不正な日付・空文字はすべて空文字を返す（画面に "NaN" を出さない）。
 */

function parse(iso: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 「M月D日」。SP の一覧・瓶で使う短い表示。 */
export function formatMonthDay(iso: string): string {
  const d = parse(iso);
  if (!d) return '';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 「YYYY-MM-DD」。ボードのカードで使う。 */
export function formatIsoDate(iso: string): string {
  const d = parse(iso);
  if (!d) return '';
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
