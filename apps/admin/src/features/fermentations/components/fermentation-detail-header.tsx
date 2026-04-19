'use client';

import { PlayCircle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { FermentationDetailResponse } from '../hooks/use-fermentation-detail';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusDotColor(status: string): string {
  if (status === 'completed') return 'bg-green-500';
  if (status === 'failed') return 'bg-red-500';
  if (status === 'processing') return 'bg-yellow-500';
  return 'bg-muted-foreground';
}

function formatCost(cost: unknown): string | null {
  if (cost == null || typeof cost !== 'object') return null;
  const obj = cost as Record<string, unknown>; // @type-assertion-allowed: cost is unknown from API, need record access for totalCost
  if (typeof obj.totalCost === 'number') {
    return `$${obj.totalCost.toFixed(6)}`;
  }
  return null;
}

interface FermentationDetailHeaderProps {
  data: FermentationDetailResponse;
  onRetry?: () => Promise<boolean>;
}

export function FermentationDetailHeader({ data, onRetry }: FermentationDetailHeaderProps) {
  const [retrying, setRetrying] = useState(false);
  const costStr = formatCost(data.cost);

  const handleRetry = async () => {
    if (!onRetry) return;
    setRetrying(true);
    await onRetry();
    setRetrying(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
          <span className={`inline-block h-2 w-2 rounded-full ${statusDotColor(data.status)}`} />
          {data.status}
        </span>
        {data.status === 'failed' && onRetry && (
          <Button variant="ghost" size="xs" disabled={retrying} onClick={handleRetry}>
            <PlayCircle className={`h-3.5 w-3.5 ${retrying ? 'animate-pulse' : ''}`} />
            Retry
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <span>
          User{' '}
          <span className="font-mono text-foreground">
            {data.userEmail || data.userId.slice(0, 8)}
          </span>
        </span>
        <span>
          Period <span className="font-mono text-foreground">{data.targetPeriod}</span>
        </span>
        <span>
          Created <span className="font-mono text-foreground">{formatDate(data.createdAt)}</span>
        </span>
        <span>
          Updated <span className="font-mono text-foreground">{formatDate(data.updatedAt)}</span>
        </span>
        {costStr && (
          <span>
            Cost <span className="font-mono text-foreground">{costStr}</span>
          </span>
        )}
      </div>

      {data.questionText && (
        <p className="text-sm text-foreground/80 leading-relaxed">
          <span className="text-xs text-muted-foreground mr-1.5">Q:</span>
          {data.questionText}
        </p>
      )}

      {data.errorMessage && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {data.errorMessage}
        </div>
      )}
    </div>
  );
}
