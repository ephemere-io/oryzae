'use client';

import { ExternalLink } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ErrorIssue, ErrorsData } from '../hooks/use-errors';

const SENTRY_ORG_URL = 'https://oryzae.sentry.io';

/**
 * 深掘りは Sentry で行う。admin に作り直さないもの（docs/observability-guide.md）。
 */
const SENTRY_DEEP_LINKS = [
  { label: 'Issues', note: 'スタックトレース・直前の操作・リプレイ', path: '/issues/' },
  { label: 'Traces', note: '遅い API・リクエストの内訳', path: '/explore/traces/' },
  { label: 'Alerts', note: '新しいエラーの通知設定', path: '/alerts/rules/' },
];

function formatDateTime(iso: string): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDay(date: string): string {
  const [, m, d] = date.split('-');
  return `${Number(m)}/${Number(d)}`;
}

function LevelDot({ level }: { level: string }) {
  const color =
    level === 'fatal' || level === 'error'
      ? 'bg-destructive'
      : level === 'warning'
        ? 'bg-yellow-500'
        : 'bg-muted-foreground';
  return <span className={`inline-block size-1.5 rounded-full ${color}`} title={level} />;
}

/**
 * 「届いていない」を「壊れていない」と読ませないための注意書き。
 * 2026-09 まで DSN が未設定のまま、画面は「No unresolved errors」を出し続けていた。
 */
function StatusNotice({ data }: { data: ErrorsData }) {
  const notices: string[] = [];
  if (data.status === 'not-configured') {
    notices.push(`Sentry を読み取れません: ${data.missing.join(', ')} が未設定です。`);
  }
  if (data.status === 'error' && data.message) notices.push(data.message);
  const unsent = [
    !data.sending.server && 'SENTRY_DSN（サーバー）',
    !data.sending.browser && 'NEXT_PUBLIC_SENTRY_DSN（ブラウザ）',
  ].filter((v): v is string => typeof v === 'string');
  if (unsent.length > 0) {
    notices.push(
      `この admin のデプロイに ${unsent.join(' と ')} がありません。その側のエラーは Sentry に送られていません。client（oryzae-client）も同じ設定か Vercel で確認してください。`,
    );
  }
  if (notices.length === 0) return null;
  return (
    <div
      className="space-y-1 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
      data-errors-notice
    >
      {notices.map((n) => (
        <p key={n}>{n}</p>
      ))}
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl font-medium tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function DailyEvents({ daily }: { daily: ErrorsData['daily'] }) {
  const max = Math.max(...daily.map((d) => d.events), 1);
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Daily Events
        </h3>
        <p className="text-[11px] text-muted-foreground">
          未解決 issue のイベント数・直近 14 日（日の区切りは 9:00 JST）
        </p>
      </div>
      <div className="flex items-end gap-[2px]">
        {daily.map((d) => (
          <div key={d.date} className="group flex min-w-[20px] flex-1 flex-col items-center">
            <span className="mb-1 font-mono text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
              {d.events}
            </span>
            <div className="relative h-24 w-full overflow-hidden rounded-t-sm bg-muted/30">
              <div
                className="absolute bottom-0 w-full rounded-t-sm bg-destructive/70"
                style={{ height: `${(d.events / max) * 100}%` }}
              />
            </div>
            <span className="mt-1 text-[10px] text-muted-foreground">{formatDay(d.date)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function IssueTable({ issues, configured }: { issues: ErrorIssue[]; configured: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-6" />
          <TableHead>エラー</TableHead>
          <TableHead className="text-right">回数</TableHead>
          <TableHead className="text-right">人数</TableHead>
          <TableHead>初回</TableHead>
          <TableHead>最終</TableHead>
          <TableHead className="w-6" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {issues.map((issue) => (
          <TableRow key={issue.id} data-issue={issue.shortId}>
            <TableCell>
              <LevelDot level={issue.level} />
            </TableCell>
            <TableCell className="max-w-md">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium">{issue.title}</p>
                {issue.isNew && (
                  <span className="shrink-0 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">
                    新規
                  </span>
                )}
              </div>
              <p className="truncate font-mono text-[11px] text-muted-foreground">
                {issue.shortId}
                {issue.culprit && ` · ${issue.culprit}`}
                {issue.isUnhandled && ' · 未処理'}
              </p>
            </TableCell>
            <TableCell className="text-right font-mono text-sm">
              {issue.count.toLocaleString()}
            </TableCell>
            <TableCell className="text-right font-mono text-sm">{issue.userCount}</TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {formatDateTime(issue.firstSeen)}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {formatDateTime(issue.lastSeen)}
            </TableCell>
            <TableCell>
              <a
                href={issue.permalink}
                target="_blank"
                rel="noopener noreferrer"
                title="Sentry で詳細を開く"
                className="text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </TableCell>
          </TableRow>
        ))}
        {issues.length === 0 && (
          <TableRow>
            <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
              {configured ? '未解決のエラーはありません' : '取得できていません（上の注意を確認）'}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

export function ErrorsView({ data }: { data: ErrorsData }) {
  const ok = data.status === 'ok';
  const newCount = data.issues.filter((i) => i.isNew).length;
  const events14d = data.daily.reduce((sum, d) => sum + d.events, 0);

  return (
    <div className="space-y-6">
      <StatusNotice data={data} />

      <div className="grid gap-6 sm:grid-cols-3">
        <Metric
          label="Unresolved"
          value={ok ? `${data.issues.length}${data.truncated ? '+' : ''}` : '-'}
          sub="未解決の issue"
        />
        <Metric
          label="New (24h)"
          value={ok ? String(newCount) : '-'}
          sub="直近 24 時間に初めて出た"
        />
        <Metric
          label="Events (14d)"
          value={ok ? events14d.toLocaleString() : '-'}
          sub="未解決 issue の発生回数"
        />
      </div>

      {ok && <DailyEvents daily={data.daily} />}

      <div className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Unresolved Issues
        </h3>
        <IssueTable issues={data.issues} configured={ok} />
      </div>

      <div className="space-y-2 border-t pt-4">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Sentry で見る
        </h3>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {SENTRY_DEEP_LINKS.map((link) => (
            <a
              key={link.label}
              href={`${SENTRY_ORG_URL}${link.path}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-baseline gap-1.5 text-sm"
            >
              <span className="font-medium group-hover:underline">{link.label}</span>
              <span className="text-xs text-muted-foreground">{link.note}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
