'use client';

import type { FermentationReadinessResponse } from '../hooks/use-fermentation-readiness';

// 発酵プロセス自動発火 (issue #268) の現状を簡潔に表示する。
// - 言語別の文字数閾値達成度 (現在/閾値)
// - 経過時間 / 必要時間 (継続使用者のみ)
// - readinessScore のバー (0.00-1.00)
// - 次回 eligible 時刻 (継続使用者のみ)
//
// 詳細は仕様メモ参照: ランダム X 時間 (24-168h) は発酵成功時に再ロールされ
// next_random_hours / next_eligible_at に保存されるため、admin から見て
// 「ユーザーには次にいつ来るか分からない」という UX を維持する。
function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function formatHours(hours: number | null): string {
  if (hours == null) return '-';
  if (hours < 1) return `${(hours * 60).toFixed(0)}m`;
  return `${hours.toFixed(1)}h`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ReadinessBar({ value }: { value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const color =
    value >= 1 ? 'bg-green-500' : value >= 0.5 ? 'bg-yellow-500' : 'bg-muted-foreground/40';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full transition-[width] ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

interface Props {
  readiness: FermentationReadinessResponse | null;
  loading: boolean;
  error: string | null;
}

export function UserFermentationReadiness({ readiness, loading, error }: Props) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        発酵プロセス自動発火条件
        {readiness && (
          <span
            className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium ${
              readiness.eligible
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {readiness.eligible ? 'eligible' : 'not yet'}
          </span>
        )}
      </h3>

      {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      {readiness && (
        <div className="space-y-3 rounded-md border border-border/40 bg-card px-3 py-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Row label="ロケール" value={readiness.language === 'ja' ? '日本語' : 'English'} />
            <Row
              label="ステータス"
              value={readiness.isFirstTime ? '新規使用者 (時間ゲートなし)' : '継続使用者'}
            />
            <Row
              label={`文字数 (閾値 ${readiness.threshold.toLocaleString()}字)`}
              value={`${readiness.charsCurrent.toLocaleString()} / ${readiness.threshold.toLocaleString()} (${formatPercent(readiness.charScore)})`}
            />
            <Row
              label={
                readiness.isFirstTime
                  ? '時間ゲート'
                  : `経過時間 (必要 ${formatHours(readiness.hoursRequired)})`
              }
              value={
                readiness.isFirstTime
                  ? '—'
                  : `${formatHours(readiness.hoursElapsed)} (${formatPercent(readiness.timeScore)})`
              }
            />
            <Row label="前回発酵" value={formatDateTime(readiness.lastRunAt)} />
            <Row label="次回 eligible" value={formatDateTime(readiness.nextEligibleAt)} />
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">readiness score</span>
              <span className="font-mono text-xs">{readiness.readinessScore.toFixed(2)}</span>
            </div>
            <ReadinessBar value={readiness.readinessScore} />
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
