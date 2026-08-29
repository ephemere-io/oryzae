'use client';

interface UserActivityCardProps {
  activeWriters: number;
  totalUsers: number;
  // 継続(リテンション): 直前の同じ長さの期間にも投稿していたユーザー数 / 直前期間のアクティブ数。
  returningUsers: number;
  previousActiveUsers: number;
  // 表示する集計期間ラベル（ダッシュボードの期間セレクタ連動）。
  periodLabel: string;
}

export function UserActivityCard({
  activeWriters,
  totalUsers,
  returningUsers,
  previousActiveUsers,
  periodLabel,
}: UserActivityCardProps) {
  const ratio = totalUsers > 0 ? (activeWriters / totalUsers) * 100 : 0;
  const retention =
    previousActiveUsers > 0 ? Math.round((returningUsers / previousActiveUsers) * 100) : null;

  return (
    <div
      className="flex flex-col justify-between rounded-lg border border-border/50 bg-card p-4"
      title="「書いた人」＝選択期間内に 1 件以上エントリを書いたユーザー。ログインしただけ・読んだだけの人は含まない。分母は profiles の総数（＝登録済みユーザー）。期間は見ている人のローカル暦日で切る。"
    >
      <div>
        {/* Issue #368: 「アクティブ」が何を指すか読み取れなかったので、ラベル自体を
            定義（書いた人）にする。閲覧やログインは含まない。 */}
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Writers ({periodLabel})
        </span>
        <div className="text-3xl font-semibold tracking-tight mt-0.5">
          {activeWriters}
          <span className="text-lg font-normal text-muted-foreground">/{totalUsers}</span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          期間内に1件以上書いた人 / 登録ユーザー
        </p>
      </div>
      <div className="mt-3 space-y-1.5">
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${ratio}%` }}
          />
        </div>
        <p
          className="text-[10px] text-muted-foreground"
          title="直前の同じ長さの期間にも投稿していたユーザー数 ÷ 直前期間のアクティブ数（継続率）"
        >
          継続 {retention === null ? '--' : `${retention}%`}
          <span className="ml-1 text-muted-foreground/70">
            ({returningUsers}/{previousActiveUsers})
          </span>
        </p>
      </div>
    </div>
  );
}
