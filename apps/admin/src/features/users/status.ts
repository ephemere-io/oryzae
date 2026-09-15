import type { AdminUser } from './hooks/use-users';

/**
 * 「最近書いているか」の判定窓（日数）。
 *
 * ジャーナリングの利用サイクルが月次であることに合わせた暫定値。変えるときは
 * ツールチップの文言も自動で追従する（この定数を埋め込んでいる）。
 */
export const ACTIVE_WINDOW_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type UserStatus = 'active' | 'dormant' | 'never';

export type UserStatusFilter = 'all' | UserStatus;

/** 判定に必要な分だけ。テストから最小の入力で呼べるようにしている。 */
type UserStatusInput = Pick<AdminUser, 'entryCount' | 'lastActivityAt'>;

/**
 * ユーザーの状態を決める。**判定に使うのはエントリーだけで、発酵は見ない。**
 *
 * 発酵は cron による自動実行なので、本人が使っているかどうかを表さない
 * （サーバー側で `lastActivityAt` を entries だけから出しているのと同じ理由。
 * `contexts/user/presentation/routes/admin-users.ts` のコメントを参照）。
 * 以前はここが `entryCount > 0 || fermentationTotal > 0` で、隣の「最終活動」列と
 * 別の基準になっていた (#620)。
 *
 * また「active = 一定期間内に書いた人」という語の意味は、ダッシュボードの
 * `activeWriters`（`contexts/shared/presentation/routes/admin-dashboard.ts`）と揃えてある。
 * 累計で判定すると、一度書いたきりの人が永久に Active のまま残る。
 */
export function deriveUserStatus(user: UserStatusInput, now: Date): UserStatus {
  if (user.entryCount === 0) return 'never';
  // 書いた記録はあるが日時が取れない場合。Active を名乗らせる根拠が無いので dormant に倒す。
  if (!user.lastActivityAt) return 'dormant';

  const lastMs = new Date(user.lastActivityAt).getTime();
  if (Number.isNaN(lastMs)) return 'dormant';

  // ちょうど窓の境界（丸 ACTIVE_WINDOW_DAYS 日前）は dormant 側に含める。
  return now.getTime() - lastMs < ACTIVE_WINDOW_DAYS * MS_PER_DAY ? 'active' : 'dormant';
}

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Active',
  dormant: 'Dormant',
  never: 'Never',
};

export const USER_STATUS_FILTER_OPTIONS: ReadonlyArray<{
  value: UserStatusFilter;
  label: string;
}> = [
  { value: 'all', label: 'すべて' },
  { value: 'active', label: USER_STATUS_LABELS.active },
  { value: 'dormant', label: USER_STATUS_LABELS.dormant },
  { value: 'never', label: USER_STATUS_LABELS.never },
];
