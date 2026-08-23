'use client';

import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { SpendData } from '../hooks/use-spend';

function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`;
}

function formatShortDate(iso: string): string {
  if (!iso) return '-';
  const [, month, day] = iso.split('-');
  return month && day ? `${Number(month)}/${Number(day)}` : iso;
}

interface MergedDay {
  date: string;
  estimatedUsd: number;
  fermentationCount: number;
}

export function SpendView({
  data,
  loading,
  error,
  onRefresh,
}: {
  data: SpendData | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const mergedDays = useMemo<MergedDay[]>(() => {
    if (!data) return [];
    return data.estimated.daily
      .map((d) => ({
        date: d.date,
        estimatedUsd: d.estimatedCostUsd,
        fermentationCount: d.fermentationCount,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data]);

  const maxDayUsd = useMemo(
    () => Math.max(...mergedDays.map((d) => d.estimatedUsd), 0.0001),
    [mergedDays],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/observability"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Observability
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-xl font-medium">AI Spend</h1>
          <span className="text-sm text-muted-foreground">Past {data?.rangeDays ?? 30} days</span>
        </div>
        <Button variant="ghost" size="icon-xs" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && !data ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
      ) : data ? (
        <>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <div className="rounded-lg border border-border/50 bg-card p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">推定コスト</p>
              <p className="text-3xl font-semibold tracking-tight mt-0.5 tabular-nums">
                {formatUsd(data.estimated.totalCostUsd)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                保存トークン × 公表単価。実請求額は{' '}
                <a
                  href="https://platform.claude.com/cost"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  Anthropic Console
                </a>{' '}
                で確認します。
              </p>
            </div>

            <div className="rounded-lg border border-border/50 bg-card p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">トークン</p>
              <p className="text-3xl font-semibold tracking-tight mt-0.5 tabular-nums">
                {data.estimated.fermentationCount}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                発酵 / in {data.estimated.inputTokens.toLocaleString()} · out{' '}
                {data.estimated.outputTokens.toLocaleString()}
              </p>
            </div>
          </div>

          {(data.estimated.untrackedCount > 0 || data.estimated.truncated) && (
            <div className="rounded-md bg-yellow-500/10 px-4 py-3 text-xs text-yellow-600 dark:text-yellow-500 space-y-1">
              {data.estimated.untrackedCount > 0 && (
                <p>
                  トークン未保存のため推定に含められなかった発酵が {data.estimated.untrackedCount}{' '}
                  件あります（推定は過少です）。
                </p>
              )}
              {data.estimated.truncated && (
                <p>件数が集計上限を超えたため、推定はさらに過少になっています。</p>
              )}
            </div>
          )}

          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
              日別コスト（推定 / UTC 日）
            </p>
            {mergedDays.length > 0 ? (
              <div className="space-y-1">
                {mergedDays.map((d) => (
                  <div key={d.date} className="flex items-center gap-3 text-sm">
                    <span className="w-10 text-right text-xs text-muted-foreground shrink-0">
                      {formatShortDate(d.date)}
                    </span>
                    <div className="flex-1 h-4 bg-muted/30 rounded-sm overflow-hidden">
                      <div
                        className="h-full bg-primary/60 rounded-sm"
                        style={{ width: `${(d.estimatedUsd / maxDayUsd) * 100}%` }}
                      />
                    </div>
                    <span className="w-20 text-right font-mono text-xs tabular-nums shrink-0">
                      {formatUsd(d.estimatedUsd)}
                    </span>
                    <span className="w-8 text-right text-xs text-muted-foreground shrink-0">
                      {d.fermentationCount}
                    </span>
                  </div>
                ))}
                <div className="flex items-center gap-3 pt-1 text-[10px] text-muted-foreground">
                  <span className="w-10 shrink-0" />
                  <span className="flex-1" />
                  <span className="w-20 text-right shrink-0">推定</span>
                  <span className="w-8 text-right shrink-0">件数</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No data</p>
            )}
          </div>

          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              ユーザー別（推定）
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              Anthropic はアプリのユーザーを識別しないため、この内訳は保存トークンからの推定です。
            </p>
            {data.estimated.byUser.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead className="text-right">発酵数</TableHead>
                      <TableHead className="text-right">Input</TableHead>
                      <TableHead className="text-right">Output</TableHead>
                      <TableHead className="text-right">推定コスト</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.estimated.byUser.map((u) => (
                      <TableRow key={u.userId}>
                        <TableCell className="text-xs">
                          {u.email || `${u.userId.slice(0, 12)}...`}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {u.fermentationCount}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {u.inputTokens.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {u.outputTokens.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatUsd(u.estimatedCostUsd)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No data</p>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
