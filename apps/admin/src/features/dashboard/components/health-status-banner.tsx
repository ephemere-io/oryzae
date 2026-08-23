'use client';

import type { CostSummary } from '../hooks/use-cost-summary';
import type { DashboardStats } from '../hooks/use-dashboard-stats';

// ダッシュボードの「今すぐ判断したい」3軸（発酵の健全性 / 要対応 / コスト / 活性）を
// 一目で読めるサマリ帯。各セルを緑=正常 / 黄=注意 / 赤=異常 で色分けする。
// 既存フックの値を props で受けるだけ（バックエンド追加なし）。

type Status = 'good' | 'warn' | 'bad' | 'neutral';

const dotColor: Record<Status, string> = {
  good: 'bg-green-500',
  warn: 'bg-amber-500',
  bad: 'bg-red-500',
  neutral: 'bg-muted-foreground/40',
};

interface HealthStatusBannerProps {
  stats: DashboardStats | null;
  failureCount: number;
  summary: CostSummary | null;
  activeWriters: number;
  totalUsers: number;
}

function HealthCell({
  label,
  value,
  sub,
  status,
}: {
  label: string;
  value: string;
  sub: string;
  status: Status;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-card p-4">
      <div className="flex items-center gap-1.5">
        <span className={`size-1.5 rounded-full ${dotColor[status]}`} />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}

export function HealthStatusBanner({
  stats,
  failureCount,
  summary,
  activeWriters,
  totalUsers,
}: HealthStatusBannerProps) {
  // 発酵成功率（期間内）
  const total = stats?.totalFermentations ?? 0;
  const completed = stats?.completedFermentations ?? 0;
  const successRate = total > 0 ? Math.round((completed / total) * 100) : null;
  const successStatus: Status =
    successRate === null
      ? 'neutral'
      : successRate >= 90
        ? 'good'
        : successRate >= 70
          ? 'warn'
          : 'bad';

  // 24h 要対応（失敗）件数
  const failStatus: Status = failureCount > 0 ? 'bad' : 'good';

  // 今月コスト着地見込み（前月比）。どちらも推定なので同じ系統で比較できる。
  const projected = summary?.projectedCost ?? null;
  const lastMonth = summary?.lastMonthCost ?? 0;
  const costStatus: Status =
    projected === null
      ? 'neutral'
      : lastMonth > 0 && projected > lastMonth * 1.5
        ? 'bad'
        : lastMonth > 0 && projected > lastMonth * 1.1
          ? 'warn'
          : 'good';

  // アクティブ率（期間内に投稿したユーザー / 全ユーザー）
  const activeRate = totalUsers > 0 ? Math.round((activeWriters / totalUsers) * 100) : null;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <HealthCell
        label="発酵成功率"
        value={successRate === null ? '--' : `${successRate}%`}
        sub={total > 0 ? `${completed} / ${total} 件` : 'データなし'}
        status={successStatus}
      />
      <HealthCell
        label="24h 要対応"
        value={failureCount === 0 ? '異常なし' : `${failureCount} 件`}
        sub={failureCount === 0 ? 'all clear' : 'retry / 対応が必要'}
        status={failStatus}
      />
      <HealthCell
        label="今月コスト着地"
        value={projected === null ? '--' : `$${projected.toFixed(2)}`}
        sub={summary ? `前月 $${lastMonth.toFixed(2)}` : '取得中'}
        status={costStatus}
      />
      <HealthCell
        label="アクティブ率"
        value={activeRate === null ? '--' : `${activeRate}%`}
        sub={`${activeWriters} / ${totalUsers} 人（期間内）`}
        status="neutral"
      />
    </div>
  );
}
