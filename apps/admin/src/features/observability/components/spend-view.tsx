'use client';

import { ExternalLink, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { SpendData } from '../hooks/use-spend';

/**
 * 実請求額の出典。画面の数字をここと突き合わせて裏取りできるようにする。
 * cost_report は UTC 日バケットなので、Console 側も UTC 表示で比べること。
 */
const ANTHROPIC_COST_CONSOLE_URL = 'https://platform.claude.com/cost';

function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`;
}

function formatShortDate(iso: string): string {
  if (!iso) return '-';
  const [, month, day] = iso.split('-');
  return month && day ? `${Number(month)}/${Number(day)}` : iso;
}

/** Anthropic Console の Cost ページへの外部リンク。 */
function ConsoleLink({ label = 'Anthropic Console' }: { label?: string }) {
  return (
    <a
      href={ANTHROPIC_COST_CONSOLE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 underline hover:text-foreground"
    >
      {label}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

/**
 * 読み込み中の骨組み。実データと同じ「3枚のカード + 表」の形にしてある。
 *
 * この画面は Anthropic の cost_report と Supabase の集計を待つため数秒かかる。
 * 素の "Loading..." だと止まって見えるので、出てくる形を先に見せる。
 */
function SpendSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="コストデータを読み込み中">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        {['actual', 'estimated', 'drift'].map((key) => (
          <div key={key} className="rounded-lg border border-border/50 bg-card p-4">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-2 h-8 w-32" />
            <Skeleton className="mt-2 h-3 w-40" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-border/50 bg-card p-4 space-y-3">
        <Skeleton className="h-3 w-24" />
        {['r1', 'r2', 'r3', 'r4', 'r5'].map((key) => (
          <Skeleton key={key} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}

/** 実請求額の見出し値。未設定・失敗を $0.0000 と出さない。 */
function ActualHeadline({ actual }: { actual: SpendData['actual'] }) {
  if (actual.status === 'not-configured') {
    return (
      <>
        <p className="text-xl font-semibold tracking-tight mt-0.5 text-muted-foreground">未設定</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          ANTHROPIC_ADMIN_KEY を設定すると実請求額を表示します（
          <ConsoleLink />
          でも確認できます）
        </p>
      </>
    );
  }
  if (actual.status === 'error') {
    return (
      <>
        <p className="text-xl font-semibold tracking-tight mt-0.5 text-destructive">取得失敗</p>
        <p className="mt-0.5 text-xs text-muted-foreground break-all">{actual.message ?? ''}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          <ConsoleLink />
          で直接確認できます
        </p>
      </>
    );
  }
  return (
    <>
      <p className="text-3xl font-semibold tracking-tight mt-0.5 tabular-nums">
        {formatUsd(actual.totalCostUsd ?? 0)}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {actual.truncated
          ? '⚠️ 集計打ち切りのため過少 / UTC 日基準'
          : 'Anthropic cost_report / UTC 日基準'}
      </p>
      {/* 数字の裏取り用。Console の Cost ページと突き合わせられるようにする。 */}
      <p className="mt-1 text-xs">
        <ConsoleLink label="Console で照合" />
      </p>
    </>
  );
}

/**
 * 推定コストの計算根拠。単価とトークン数を出して、その場で検算できるようにする。
 * 実額は Console のリンクで裏取りできるが、推定は式を見せないと確かめようがない。
 */
function EstimateBasis({ estimated }: { estimated: SpendData['estimated'] }) {
  const { pricing, inputTokens, outputTokens } = estimated;
  const inputUsd = (inputTokens * pricing.inputUsdPerMTok) / 1_000_000;
  const outputUsd = (outputTokens * pricing.outputUsdPerMTok) / 1_000_000;

  return (
    <details className="mt-2 text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none hover:text-foreground">計算根拠</summary>
      <div className="mt-1.5 space-y-0.5 font-mono tabular-nums">
        <p>{pricing.modelId}</p>
        <p>
          in {inputTokens.toLocaleString()} × ${pricing.inputUsdPerMTok.toFixed(2)}/MTok ={' '}
          {formatUsd(inputUsd)}
        </p>
        <p>
          out {outputTokens.toLocaleString()} × ${pricing.outputUsdPerMTok.toFixed(2)}/MTok ={' '}
          {formatUsd(outputUsd)}
        </p>
        <p className="border-t border-border/50 pt-0.5">計 {formatUsd(inputUsd + outputUsd)}</p>
      </div>
      <p className="mt-1.5 font-sans">
        保存済みトークン数に公表単価を掛けたもの。トークン数は Anthropic の応答に含まれる値です。
      </p>
    </details>
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
    // 実額が打ち切られている場合、乖離率は「推定が過大」に見えるだけの誤情報になる。
    if (data?.actual.status !== 'ok' || data.actual.totalCostUsd === null) return null;
    if (data.actual.truncated) return null;
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
        <SpendSkeleton />
      ) : data ? (
        <>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <div className="rounded-lg border border-border/50 bg-card p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                実請求額 (org 全体)
              </p>
              <ActualHeadline actual={data.actual} />
            </div>

            <div className="rounded-lg border border-border/50 bg-card p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                推定コスト (発酵・記録分)
              </p>
              <p className="text-3xl font-semibold tracking-tight mt-0.5 tabular-nums">
                {formatUsd(data.estimated.totalCostUsd)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {data.estimated.fermentationCount} 発酵 / in{' '}
                {data.estimated.inputTokens.toLocaleString()} · out{' '}
                {data.estimated.outputTokens.toLocaleString()}
              </p>
              {/* 実額は Console で裏取りできるが、推定は計算式を出さないと検算できない。 */}
              <EstimateBasis estimated={data.estimated} />
            </div>

            <div className="rounded-lg border border-border/50 bg-card p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">推定の乖離</p>
              <p className="text-3xl font-semibold tracking-tight mt-0.5 tabular-nums">
                {drift === null ? '-' : `${drift > 0 ? '+' : ''}${drift.toFixed(1)}%`}
              </p>
              {/* drift は (推定 − 実請求) ÷ 実請求。実請求は org 全体で Oryzae 外の
                  利用も含むため、通常はマイナス（推定のほうが小さい）になる。 */}
              <p className="mt-0.5 text-xs text-muted-foreground">
                {drift === null
                  ? '実請求額が取得できると表示されます'
                  : '推定は発酵のみ。実請求は org 全体なので通常マイナス'}
              </p>
            </div>
          </div>

          {/* 用途別の内訳は **実額** で出す。cost_report を group_by[]=description で
              取るとモデル別に割れ、Oryzae は用途ごとに別モデルを使っているので、
              モデル別内訳がそのまま用途別の実額になる。「OCR がいくらか」はここで読む。 */}
          {data.actual.status === 'ok' && data.actual.byModel.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                実請求額の内訳（モデル別）
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Anthropic は「用途」を知りません。用途名は
                <strong>そのモデルを使っている機能</strong>を 指すだけで、同じモデルの他の利用（CI
                のレビュー等）も同じ行に含まれます。
              </p>
              <div className="space-y-2">
                {data.actual.byModel.map((m) => (
                  <div key={m.model} className="rounded-lg border border-border/50 bg-card p-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-mono text-sm">
                        {m.model}
                        {m.feature && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ← {m.feature} のモデル
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-sm tabular-nums">{formatUsd(m.costUsd)}</span>
                    </div>
                    {/* token_type の内訳。キャッシュ読み書きが混ざっていればここに出る
                        （自前推定では表現できない部分）。 */}
                    {m.byTokenType.length > 0 && (
                      <div className="mt-1.5 space-y-0.5 font-mono text-xs text-muted-foreground tabular-nums">
                        {m.byTokenType.map((t) => (
                          <div key={t.tokenType} className="flex justify-between gap-3">
                            <span>{t.tokenType}</span>
                            <span>{formatUsd(t.costUsd)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

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
            {/* Console の Cost ページも UTC 日バケットなので、日付をそのまま突き合わせられる。 */}
            <p className="text-xs text-muted-foreground mb-3">
              実請求は <ConsoleLink label="Anthropic Console の Cost ページ" /> と同じ UTC
              日で並んでいます。
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
              Anthropic
              はアプリのユーザーを識別しないため、この内訳は保存トークンからの推定です（発酵のみ）。
              ユーザー別だけは実額で出せないので、推定を残しています。
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
