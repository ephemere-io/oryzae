'use client';

import { ArrowRight, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { EnvVarPresence, ToolsSummary } from '../hooks/use-tools-summary';

/**
 * Oryzae が連携している外部ツールの一覧（SSOT）。
 *
 * ツールを足したら、ここに 1 行足す。サーバーが読む環境変数の一覧は
 * `admin-tools.ts` の TOOL_ENV が正で、ここは `env` をそのまま表示するだけ。
 * 何を admin で見て何をコンソールで見るかは docs/observability-guide.md。
 */
interface ToolRow {
  id: string;
  name: string;
  /** 何のために使っているか。1 行で。 */
  role: string;
  status: string;
  /** admin の中の詳細ページ。 */
  adminHref: string | null;
  adminLabel: string | null;
  consoleUrl: string | null;
}

function formatNumber(value: number | null): string {
  return value === null ? '-' : value.toLocaleString();
}

/**
 * 実請求額の表示。未設定・取得失敗を「$0.00」と出さないこと。
 * それをやると issue #352 以降ずっと出ていた「コストが常に0」の再来になる。
 */
function formatAnthropicStatus(anthropic: ToolsSummary['anthropic']): string {
  if (anthropic.status === 'not-configured') return 'ADMIN_KEY 未設定';
  if (anthropic.status === 'error') return '取得失敗';
  if (anthropic.monthlySpend === null) return '-';
  return `今月 $${anthropic.monthlySpend.toFixed(2)}`;
}

function formatSentryStatus(sentry: ToolsSummary['sentry']): string {
  if (sentry.status === 'not-configured') return '読み取り未設定';
  if (sentry.status === 'error') return '取得失敗';
  return `未解決 ${formatNumber(sentry.unresolvedCount)} 件`;
}

function buildRows(data: ToolsSummary): ToolRow[] {
  return [
    {
      id: 'sentry',
      name: 'Sentry',
      role: 'エラー監視。本番で何が壊れたか・どの API で・何人に',
      status: formatSentryStatus(data.sentry),
      adminHref: '/errors',
      adminLabel: 'Errors',
      consoleUrl: 'https://oryzae.sentry.io/issues/',
    },
    {
      id: 'posthog',
      name: 'PostHog',
      role: 'プロダクト分析。誰がどう使っているか',
      status: data.posthog
        ? `7日 ${formatNumber(data.posthog.totalPageviews)} PV / ${formatNumber(data.posthog.totalSessions)} セッション`
        : '-',
      adminHref: '/analytics',
      adminLabel: 'Analytics',
      consoleUrl: 'https://us.posthog.com/project/378500',
    },
    {
      id: 'anthropic',
      name: 'Anthropic',
      role: 'LLM（発酵・OCR）と、その実請求額',
      status: formatAnthropicStatus(data.anthropic),
      adminHref: '/tools/spend',
      adminLabel: 'AI Spend',
      consoleUrl: 'https://platform.claude.com/cost',
    },
    {
      id: 'supabase',
      name: 'Supabase',
      role: 'DB・認証・ストレージ（日記の保管先）',
      status: '-',
      adminHref: null,
      adminLabel: null,
      consoleUrl: 'https://supabase.com/dashboard/projects',
    },
    {
      id: 'vercel',
      name: 'Vercel',
      role: 'ホスティング・デプロイ・ランタイムログ',
      status: data.vercel.latestDeployState ?? '-',
      adminHref: '/tools/deploys',
      adminLabel: 'Deploys',
      consoleUrl: 'https://vercel.com/ephemere-io',
    },
    {
      id: 'resend',
      name: 'Resend',
      role: 'メール送信（認証・発酵の通知）',
      status:
        data.resend.sentCount7d !== null
          ? `7日 ${formatNumber(data.resend.sentCount7d)} 通 / 不達 ${formatNumber(data.resend.bouncedCount7d)}`
          : '-',
      adminHref: null,
      adminLabel: null,
      consoleUrl: 'https://resend.com/emails',
    },
    {
      id: 'upstash',
      name: 'Upstash',
      role: 'API のレート制限（Redis）',
      status: data.upstash.totalKeys !== null ? `${data.upstash.totalKeys} keys` : '-',
      adminHref: null,
      adminLabel: null,
      consoleUrl: 'https://console.upstash.com',
    },
    {
      id: 'discord',
      name: 'Discord',
      role: '運用通知（日次コストレポート等）の送り先',
      status: '-',
      adminHref: null,
      adminLabel: null,
      consoleUrl: null,
    },
    // 外部ツールではないが並べる。「勝手に動いているもの」が一覧に無いのは抜けである。
    //
    // 件数はあえてここで数えない。admin は feature 間の import を禁じており
    // （dep-cruise の feature-isolation）、tools から automation を読むと違反になる。
    // 数はリンク先のページが自分で出す。
    {
      id: 'github-actions',
      name: 'GitHub Actions',
      role: '自動実行（CI・E2E・定期監査・依存更新）',
      status: '-',
      adminHref: '/tools/automation',
      adminLabel: 'Automation',
      consoleUrl: 'https://github.com/ephemere-io/oryzae/actions',
    },
  ];
}

function EnvCell({ vars }: { vars: EnvVarPresence[] | undefined }) {
  if (!vars || vars.length === 0) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }
  const missing = vars.filter((v) => !v.set);
  return (
    <div className="space-y-0.5">
      <span
        className={cn(
          'font-mono text-xs',
          missing.length === 0 ? 'text-muted-foreground' : 'text-destructive',
        )}
      >
        {vars.length - missing.length}/{vars.length}
      </span>
      {missing.map((v) => (
        <p key={v.name} className="font-mono text-[11px] text-destructive">
          {v.name} 未設定
        </p>
      ))}
    </div>
  );
}

export function ToolsTable({ data }: { data: ToolsSummary }) {
  const rows = buildRows(data);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tool</TableHead>
          <TableHead>役割</TableHead>
          <TableHead>状態</TableHead>
          <TableHead>環境変数</TableHead>
          <TableHead>詳細</TableHead>
          <TableHead className="w-8" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id} data-tool={row.id}>
            <TableCell className="text-sm font-medium">{row.name}</TableCell>
            <TableCell className="max-w-xs text-xs text-muted-foreground">{row.role}</TableCell>
            <TableCell className="font-mono text-sm">{row.status}</TableCell>
            <TableCell>
              <EnvCell vars={data.env[row.id]} />
            </TableCell>
            <TableCell>
              {row.adminHref && (
                <Link
                  href={row.adminHref}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {row.adminLabel}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </TableCell>
            <TableCell>
              {row.consoleUrl && (
                <a
                  href={row.consoleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${row.name} のコンソールを開く`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
