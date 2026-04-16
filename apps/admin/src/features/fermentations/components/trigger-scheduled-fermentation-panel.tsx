'use client';

import { Play } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTriggerScheduledFermentation } from '../hooks/use-trigger-scheduled-fermentation';

/**
 * JST での「昨日」を YYYY-MM-DD で返す。input[type=date] の初期値 + UX プレビュー用。
 * サーバ側でも dateKey 未指定時は JST 前日がデフォルト。
 */
function getJstYesterdayDateKey(): string {
  const now = new Date();
  const jstOffsetMs = 9 * 60 * 60 * 1000;
  const jst = new Date(now.getTime() + jstOffsetMs);
  jst.setUTCDate(jst.getUTCDate() - 1);
  return jst.toISOString().slice(0, 10);
}

interface Props {
  onCompleted?: () => void;
}

export function TriggerScheduledFermentationPanel({ onCompleted }: Props) {
  const [dateKey, setDateKey] = useState(getJstYesterdayDateKey());
  const [confirming, setConfirming] = useState(false);
  const { trigger, loading, error, result } = useTriggerScheduledFermentation();

  const handleRun = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    const ok = await trigger(dateKey);
    if (ok) onCompleted?.();
  };

  return (
    <div className="rounded-md border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">手動で発酵プロセスを発火</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            指定日 (JST) のエントリに対して ScheduledFermentation を実行します
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dateKey}
            onChange={(e) => {
              setDateKey(e.target.value);
              setConfirming(false);
            }}
            disabled={loading}
            className="w-auto h-8 text-xs"
          />
          <Button
            variant={confirming ? 'destructive' : 'default'}
            size="sm"
            onClick={handleRun}
            disabled={loading || !dateKey}
          >
            <Play className={`h-3 w-3 mr-1.5 ${loading ? 'animate-pulse' : ''}`} />
            {loading ? '実行中...' : confirming ? '本当に実行する' : '実行'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-md bg-muted/50 px-3 py-2 text-xs space-y-1">
          <div className="font-mono text-muted-foreground">
            {result.dateKey} — users: {result.totalUsers} · fermentations:{' '}
            {result.totalFermentations} · succeeded: {result.succeeded} · failed: {result.failed}
          </div>
          {result.errors.length > 0 && (
            <details className="text-destructive">
              <summary className="cursor-pointer">errors ({result.errors.length})</summary>
              <ul className="mt-1 space-y-0.5 font-mono">
                {result.errors.map((e) => (
                  <li key={`${e.userId}-${e.questionId}`}>
                    {e.userId.slice(0, 8)} / {e.questionId.slice(0, 8)}: {e.error}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
