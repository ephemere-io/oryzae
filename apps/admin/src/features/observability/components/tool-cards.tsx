'use client';

import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ObservabilitySummary } from '../hooks/use-observability';

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function ToolCard({
  name,
  tagline,
  href,
  externalUrl,
  children,
}: {
  name: string;
  tagline: string;
  href?: string;
  externalUrl: string;
  children?: React.ReactNode;
}) {
  const card = (
    <Card className="transition-colors hover:bg-muted/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{name}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{tagline}</p>
          </div>
          {!href && <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />}
        </div>
      </CardHeader>
      {children && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );

  if (href) {
    return <Link href={href}>{card}</Link>;
  }
  return (
    <a href={externalUrl} target="_blank" rel="noopener noreferrer">
      {card}
    </a>
  );
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

export function ObservabilityCards({ data }: { data: ObservabilitySummary }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <ToolCard
        name="PostHog"
        tagline="ユーザー行動分析"
        href="/analytics"
        externalUrl="https://us.posthog.com/project/378500"
      >
        {data.posthog && (
          <div className="flex gap-2">
            <Metric label="今週の PV" value={data.posthog.totalPageviews.toLocaleString()} />
            <Metric label="セッション" value={data.posthog.totalSessions.toLocaleString()} />
          </div>
        )}
      </ToolCard>

      <ToolCard
        name="Sentry"
        tagline="エラー監視"
        href="/observability/errors"
        externalUrl="https://oryzae.sentry.io"
      >
        {data.sentry.unresolvedCount !== null && (
          <Metric label="未解決エラー" value={`${data.sentry.unresolvedCount} 件`} />
        )}
      </ToolCard>

      <ToolCard
        name="Vercel AI Gateway"
        tagline="LLM コスト追跡"
        href="/observability/spend"
        externalUrl="https://vercel.com"
      >
        <div className="flex gap-2 flex-wrap">
          {data.gateway.monthlySpend !== null && (
            <Metric label="今月のコスト" value={formatCost(data.gateway.monthlySpend)} />
          )}
          {data.gateway.monthlyRequests !== null && (
            <Metric label="リクエスト数" value={`${data.gateway.monthlyRequests}`} />
          )}
          {data.gateway.creditBalance !== null && (
            <Metric label="残高" value={`$${Number(data.gateway.creditBalance).toFixed(2)}`} />
          )}
        </div>
      </ToolCard>

      <ToolCard
        name="Upstash Redis"
        tagline="API レート制限"
        externalUrl="https://console.upstash.com"
      >
        {data.upstash.totalKeys !== null && (
          <Metric label="Redis キー数" value={`${data.upstash.totalKeys}`} />
        )}
      </ToolCard>

      <ToolCard
        name="Vercel"
        tagline="デプロイ・ホスティング"
        href="/observability/deploys"
        externalUrl="https://vercel.com"
      >
        {data.vercel.latestDeployState && (
          <Metric label="最新デプロイ" value={data.vercel.latestDeployState} />
        )}
      </ToolCard>
    </div>
  );
}
