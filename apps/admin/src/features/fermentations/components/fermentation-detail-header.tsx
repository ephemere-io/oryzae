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

type RetryState = 'idle' | 'retrying' | 'success' | 'error';

export function FermentationDetailHeader({ data, onRetry }: FermentationDetailHeaderProps) {
  const [retryState, setRetryState] = useState<RetryState>('idle');
  const costStr = formatCost(data.cost);

  // retry は LLM 再生成を同期実行するため数十秒かかる。無反応に見えないよう、
  // 実行中 / 成功 / 失敗を明示する (特に失敗時は従来何も表示されなかった)。
  const handleRetry = async () => {
    if (!onRetry) return;
    setRetryState('retrying');
    try {
      const ok = await onRetry();
      setRetryState(ok ? 'success' : 'error');
    } catch {
      setRetryState('error');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
          <span className={`inline-block h-2 w-2 rounded-full ${statusDotColor(data.status)}`} />
          {data.status}
        </span>
        {data.status === 'failed' && onRetry && (
          <Button
            variant="ghost"
            size="xs"
            disabled={retryState === 'retrying'}
            onClick={handleRetry}
          >
            <PlayCircle
              className={`h-3.5 w-3.5 ${retryState === 'retrying' ? 'animate-pulse' : ''}`}
            />
            {retryState === 'retrying' ? '再生成中…' : 'Retry'}
          </Button>
        )}
        {retryState === 'retrying' && (
          <span className="text-xs text-muted-foreground">LLM で再生成中… 数十秒かかります</span>
        )}
        {retryState === 'success' && <span className="text-xs text-green-600">再生成しました</span>}
        {retryState === 'error' && (
          <span className="text-xs text-destructive">
            再生成に失敗しました。時間をおいて再試行してください
          </span>
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
