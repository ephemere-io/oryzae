'use client';

import { ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ObservabilitySummary } from '../hooks/use-observability';

function formatMetric(value: number | string | null, suffix = ''): string {
  if (value === null) return '-';
  if (typeof value === 'number') return `${value.toLocaleString()}${suffix}`;
  return value;
}

/**
 * 実請求額の表示。未設定・取得失敗を「$0.00」と出さないこと。
 * それをやると issue #352 以降ずっと出ていた「コストが常に0」の再来になる。
 */
function formatAnthropicMetric(anthropic: ObservabilitySummary['anthropic']): string {
  if (anthropic.status === 'not-configured') return 'ADMIN_KEY 未設定';
  if (anthropic.status === 'error') return '取得失敗';
  if (anthropic.monthlySpend === null) return '-';
  return `$${anthropic.monthlySpend.toFixed(2)} MTD`;
}

interface ToolRow {
  id: string;
  name: string;
  category: string;
  metric: string;
  href: string | null;
  externalUrl: string;
}

function buildRows(data: ObservabilitySummary): ToolRow[] {
  return [
    {
      id: 'posthog',
      name: 'PostHog',
      category: 'Analytics',
      metric:
        data.posthog && typeof data.posthog.totalPageviews === 'number'
          ? `${formatMetric(data.posthog.totalPageviews)} PV / ${formatMetric(data.posthog.totalSessions)} sessions`
          : '-',
      href: '/analytics',
      externalUrl: 'https://us.posthog.com/project/378500',
    },
    {
      id: 'sentry',
      name: 'Sentry',
      category: 'Errors',
      metric:
        data.sentry.unresolvedCount !== null ? `${data.sentry.unresolvedCount} unresolved` : '-',
      href: '/observability/errors',
      externalUrl: 'https://oryzae.sentry.io',
    },
    {
      id: 'anthropic',
      name: 'Anthropic',
      category: 'LLM Cost',
      metric: formatAnthropicMetric(data.anthropic),
      href: '/observability/spend',
      externalUrl: 'https://platform.claude.com/cost',
    },
    {
      id: 'resend',
      name: 'Resend',
      category: 'Email',
      metric:
        data.resend.sentCount7d !== null
          ? `${formatMetric(data.resend.sentCount7d)} sent / ${formatMetric(data.resend.bouncedCount7d)} bounced (7d)`
          : '-',
      href: null,
      externalUrl: 'https://resend.com/emails',
    },
    {
      id: 'upstash',
      name: 'Upstash',
      category: 'Rate Limiting',
      metric: data.upstash.totalKeys !== null ? `${data.upstash.totalKeys} keys` : '-',
      href: null,
      externalUrl: 'https://console.upstash.com',
    },
    {
      id: 'vercel',
      name: 'Vercel',
      category: 'Deploys',
      metric: data.vercel.latestDeployState ?? '-',
      href: '/observability/deploys',
      externalUrl: 'https://vercel.com',
    },
  ];
}

export function ObservabilityTable({ data }: { data: ObservabilitySummary }) {
  const router = useRouter();
  const rows = buildRows(data);

  function handleRowClick(row: ToolRow) {
    if (row.href) {
      router.push(row.href);
    } else {
      window.open(row.externalUrl, '_blank');
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tool</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-8" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id} className="cursor-pointer" onClick={() => handleRowClick(row)}>
            <TableCell className="font-medium text-sm">{row.name}</TableCell>
            <TableCell className="text-xs text-muted-foreground">{row.category}</TableCell>
            <TableCell className="font-mono text-sm">{row.metric}</TableCell>
            <TableCell>
              {!row.href && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
