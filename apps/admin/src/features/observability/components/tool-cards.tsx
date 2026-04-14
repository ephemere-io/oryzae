'use client';

import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { ObservabilitySummary } from '../hooks/use-observability';

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
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
    <div className="rounded-lg border border-border/50 bg-card p-4 transition-colors hover:border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{name}</span>
          <span className="text-xs text-muted-foreground">{tagline}</span>
        </div>
        {!href && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
      </div>
      {children}
    </div>
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
  return `$${cost.toFixed(2)}`;
}

export function ObservabilityCards({ data }: { data: ObservabilitySummary }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <ToolCard
        name="PostHog"
        tagline="Analytics"
        href="/analytics"
        externalUrl="https://us.posthog.com/project/378500"
      >
        {data.posthog && typeof data.posthog.totalPageviews === 'number' && (
          <div className="mt-3 flex gap-6">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">PV</p>
              <p className="text-xl font-semibold tabular-nums">
                {data.posthog.totalPageviews.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Sessions</p>
              <p className="text-xl font-semibold tabular-nums">
                {(data.posthog.totalSessions ?? 0).toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </ToolCard>

      <ToolCard
        name="Sentry"
        tagline="Errors"
        href="/observability/errors"
        externalUrl="https://oryzae.sentry.io"
      >
        {data.sentry.unresolvedCount !== null && (
          <Metric label="Unresolved" value={`${data.sentry.unresolvedCount}`} />
        )}
      </ToolCard>

      <ToolCard
        name="AI Gateway"
        tagline="LLM Cost"
        href="/observability/spend"
        externalUrl="https://vercel.com"
      >
        <div className="mt-3 flex gap-6">
          {data.gateway.creditBalance !== null && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Balance</p>
              <p className="text-xl font-semibold tabular-nums">
                {formatCost(Number(data.gateway.creditBalance))}
              </p>
            </div>
          )}
          {data.gateway.monthlyRequests !== null && data.gateway.monthlyRequests > 0 && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">This month</p>
              <p className="text-xl font-semibold tabular-nums">
                {data.gateway.monthlyRequests} req
              </p>
            </div>
          )}
        </div>
      </ToolCard>

      <ToolCard name="Upstash" tagline="Rate Limiting" externalUrl="https://console.upstash.com">
        {data.upstash.totalKeys !== null && (
          <Metric label="Redis Keys" value={`${data.upstash.totalKeys}`} />
        )}
      </ToolCard>

      <ToolCard
        name="Vercel"
        tagline="Deploys"
        href="/observability/deploys"
        externalUrl="https://vercel.com"
      >
        {data.vercel.latestDeployState && (
          <div className="mt-3 flex items-center gap-2">
            <span
              className={`size-1.5 rounded-full ${data.vercel.latestDeployState === 'READY' ? 'bg-green-500' : data.vercel.latestDeployState === 'ERROR' ? 'bg-red-500' : 'bg-yellow-500'}`}
            />
            <span className="text-sm">{data.vercel.latestDeployState}</span>
          </div>
        )}
      </ToolCard>
    </div>
  );
}
