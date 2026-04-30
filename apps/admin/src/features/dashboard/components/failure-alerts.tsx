'use client';

import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { FailureGroup } from '../hooks/use-failure-alerts';

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}...`;
}

function RetryButton({
  fermentationId,
  onRetry,
}: {
  fermentationId: string;
  onRetry: (id: string) => Promise<boolean>;
}) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    await onRetry(fermentationId);
    setRetrying(false);
  };

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={handleRetry}
      disabled={retrying}
      className="shrink-0 text-muted-foreground hover:text-foreground"
    >
      <RotateCcw className={`size-3 ${retrying ? 'animate-spin' : ''}`} />
    </Button>
  );
}

export function FailureAlerts({
  groups,
  retryFermentation,
}: {
  groups: FailureGroup[];
  retryFermentation: (id: string) => Promise<boolean>;
}) {
  const totalFailures = groups.reduce((sum, g) => sum + g.failures.length, 0);
  const hasFailures = groups.length > 0;

  if (!hasFailures) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card px-4 py-2.5">
        <span className="size-1.5 rounded-full bg-green-500" />
        <span className="text-xs text-muted-foreground">All clear</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/50 bg-card">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          要対応
        </span>
        <span className="inline-flex items-center justify-center rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
          {totalFailures}
        </span>
      </div>
      <div className="divide-y divide-border/30">
        {groups.flatMap((group) =>
          group.failures.map((f) => (
            <div key={f.id} className="flex items-center gap-3 px-4 py-2">
              <span className="size-1.5 shrink-0 rounded-full bg-red-500" />
              <span className="shrink-0 text-xs text-muted-foreground w-36 truncate">
                {group.email}
              </span>
              <span
                className="flex-1 truncate text-sm text-foreground/80"
                title={f.errorMessage ?? ''}
              >
                {truncate(f.errorMessage ?? '不明なエラー', 80)}
              </span>
              <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                {formatRelativeTime(f.createdAt)}
              </span>
              <RetryButton fermentationId={f.id} onRetry={retryFermentation} />
            </div>
          )),
        )}
      </div>
    </div>
  );
}
