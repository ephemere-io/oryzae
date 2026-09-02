import type { AdminUser } from './hooks/use-users';

export type UserSortKey =
  | 'email'
  | 'createdAt'
  | 'lastSignInAt'
  | 'lastActivityAt'
  | 'entryCount'
  | 'questionCount'
  | 'fermentationTotal';

export type SortDir = 'asc' | 'desc';

/**
 * 日時どうしの比較。**未記録（null）は昇順・降順のどちらでも末尾に寄せる。**
 *
 * 「一度もログインしていない」「一度も書いていない」行が先頭を占めると一覧が読めない
 * ため。null の扱いをここに閉じ込めてあるので、値の比較側は素直な引き算でよい
 * （±Infinity 同士を引いて NaN になる経路が構造的に存在しない。comparator が NaN を
 * 返すと sort の結果は仕様上未定義になる）。
 */
export function compareNullableDates(a: string | null, b: string | null, dir: SortDir): number {
  if (!a && !b) return 0;
  if (!a) return 1; // 未記録は常に後ろ
  if (!b) return -1;
  const diff = new Date(a).getTime() - new Date(b).getTime();
  return dir === 'asc' ? diff : -diff;
}

/** 一覧の並び替え。日時列だけ null の扱いが特殊なので compareNullableDates に委ねる。 */
export function compareUsers(a: AdminUser, b: AdminUser, key: UserSortKey, dir: SortDir): number {
  const mul = dir === 'asc' ? 1 : -1;
  switch (key) {
    case 'email':
      return mul * a.email.localeCompare(b.email);
    case 'createdAt':
      return mul * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    case 'lastSignInAt':
      return compareNullableDates(a.lastSignInAt, b.lastSignInAt, dir);
    case 'lastActivityAt':
      return compareNullableDates(a.lastActivityAt, b.lastActivityAt, dir);
    case 'entryCount':
      return mul * (a.entryCount - b.entryCount);
    case 'questionCount':
      return mul * (a.questionCount - b.questionCount);
    case 'fermentationTotal':
      return mul * (a.fermentationTotal - b.fermentationTotal);
    default:
      return 0;
  }
}
