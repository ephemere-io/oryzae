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
      metric: data.posthog
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
      id: 'gateway',
      name: 'AI Gateway',
      category: 'LLM Cost',
      metric:
        data.gateway.creditBalance !== null
          ? `$${Number(data.gateway.creditBalance).toFixed(2)} balance`
          : '-',
      href: '/observability/spend',
      externalUrl: 'https://vercel.com',
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
