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

/** 実請求額の見出し値。未設定・失敗を $0.0000 と出さない。 */
function ActualHeadline({ actual }: { actual: SpendData['actual'] }) {
  if (actual.status === 'not-configured') {
    return (
      <>
        <p className="text-xl font-semibold tracking-tight mt-0.5 text-muted-foreground">未設定</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          ANTHROPIC_ADMIN_KEY を設定すると実請求額を表示します
        </p>
      </>
    );
  }
  if (actual.status === 'error') {
    return (
      <>
        <p className="text-xl font-semibold tracking-tight mt-0.5 text-destructive">取得失敗</p>
        <p className="mt-0.5 text-xs text-muted-foreground break-all">{actual.message ?? ''}</p>
      </>
    );
  }
  return (
    <>
      <p className="text-3xl font-semibold tracking-tight mt-0.5 tabular-nums">
        {formatUsd(actual.totalCostUsd ?? 0)}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">Anthropic cost_report / UTC 日基準</p>
    </>
  );
}

interface MergedDay {
  date: string;
  actualUsd: number | null;
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
    const byDate = new Map<string, MergedDay>();
    for (const d of data.estimated.daily) {
      byDate.set(d.date, {
        date: d.date,
        actualUsd: null,
        estimatedUsd: d.estimatedCostUsd,
        fermentationCount: d.fermentationCount,
      });
    }
    for (const d of data.actual.daily) {
      const current = byDate.get(d.date);
      if (current) {
        current.actualUsd = d.costUsd;
      } else {
        byDate.set(d.date, {
          date: d.date,
          actualUsd: d.costUsd,
          estimatedUsd: 0,
          fermentationCount: 0,
        });
      }
    }
    return Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [data]);

  const maxDayUsd = useMemo(
    () => Math.max(...mergedDays.map((d) => Math.max(d.actualUsd ?? 0, d.estimatedUsd)), 0.0001),
    [mergedDays],
  );

  const drift = useMemo(() => {
    if (!data || data.actual.status !== 'ok' || data.actual.totalCostUsd === null) return null;
    const actualUsd = data.actual.totalCostUsd;
    const estimatedUsd = data.estimated.totalCostUsd;
    if (actualUsd === 0) return null;
    return ((estimatedUsd - actualUsd) / actualUsd) * 100;
  }, [data]);

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
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <div className="rounded-lg border border-border/50 bg-card p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                実請求額 (Anthropic)
              </p>
              <ActualHeadline actual={data.actual} />
            </div>

            <div className="rounded-lg border border-border/50 bg-card p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                推定コスト (自前トークン)
              </p>
              <p className="text-3xl font-semibold tracking-tight mt-0.5 tabular-nums">
                {formatUsd(data.estimated.totalCostUsd)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {data.estimated.fermentationCount} 発酵 / in{' '}
                {data.estimated.inputTokens.toLocaleString()} · out{' '}
                {data.estimated.outputTokens.toLocaleString()}
              </p>
            </div>

            <div className="rounded-lg border border-border/50 bg-card p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">推定の乖離</p>
              <p className="text-3xl font-semibold tracking-tight mt-0.5 tabular-nums">
                {drift === null ? '-' : `${drift > 0 ? '+' : ''}${drift.toFixed(1)}%`}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {drift === null ? '実請求額が取得できると表示されます' : '推定 − 実請求額'}
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
              日別コスト（UTC 日）
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
                        style={{
                          width: `${((d.actualUsd ?? d.estimatedUsd) / maxDayUsd) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="w-20 text-right font-mono text-xs tabular-nums shrink-0">
                      {d.actualUsd === null ? '—' : formatUsd(d.actualUsd)}
                    </span>
                    <span className="w-20 text-right font-mono text-xs tabular-nums shrink-0 text-muted-foreground">
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
                  <span className="w-20 text-right shrink-0">実請求</span>
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
