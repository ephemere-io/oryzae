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
import type { SpendData, SpendPricing } from '../hooks/use-spend';

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
 *
 * 単価は必ず引数で受ける。用途ごとにモデルが違う（発酵 claude-sonnet-4-6、
 * OCR claude-opus-5）ので、画面側に固定値を置くと片方が黙って誤表示になる。
 */
function EstimateBasis({
  pricing,
  inputTokens,
  outputTokens,
}: {
  pricing: SpendPricing;
  inputTokens: number;
  outputTokens: number;
}) {
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
  /** 発酵 + OCR。実請求と並べる相手はこの合計。 */
  estimatedUsd: number;
  fermentationCount: number;
  ocrCount: number;
}

/** ユーザー1人の推定コスト。発酵と OCR を合算する（カードの合計と一致させるため）。 */
interface MergedUser {
  userId: string;
  email: string;
  estimatedCostUsd: number;
  inputTokens: number;
  outputTokens: number;
  fermentationCount: number;
  ocrCount: number;
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
    const dayOf = (date: string): MergedDay => {
      const current = byDate.get(date) ?? {
        date,
        actualUsd: null,
        estimatedUsd: 0,
        fermentationCount: 0,
        ocrCount: 0,
      };
      byDate.set(date, current);
      return current;
    };

    for (const d of data.estimated.fermentation.daily) {
      const day = dayOf(d.date);
      day.estimatedUsd += d.estimatedCostUsd;
      day.fermentationCount += d.fermentationCount;
    }
    // OCR も同じ日に足す。ここで足さないと、日別だけ OCR 分が抜けて
    // カードの合計と行の和が合わなくなる。
    for (const d of data.estimated.ocr.daily) {
      const day = dayOf(d.date);
      day.estimatedUsd += d.estimatedCostUsd;
      day.ocrCount += d.requestCount;
    }
    for (const d of data.actual.daily) {
      dayOf(d.date).actualUsd = d.costUsd;
    }
    return Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [data]);

  // ユーザー別も発酵 + OCR。片方だけ出すと表の和がカードの推定合計と合わない。
  const mergedUsers = useMemo<MergedUser[]>(() => {
    if (!data) return [];
    const byUser = new Map<string, MergedUser>();
    const userOf = (userId: string, email: string): MergedUser => {
      const current = byUser.get(userId);
      if (!current) {
        const created = {
          userId,
          email,
          estimatedCostUsd: 0,
          inputTokens: 0,
          outputTokens: 0,
          fermentationCount: 0,
          ocrCount: 0,
        };
        byUser.set(userId, created);
        return created;
      }
      // 片方の集計でしか email を解決できていない場合に備えて拾う。
      if (!current.email && email) current.email = email;
      return current;
    };

    for (const u of data.estimated.fermentation.byUser) {
      const row = userOf(u.userId, u.email);
      row.estimatedCostUsd += u.estimatedCostUsd;
      row.inputTokens += u.inputTokens;
      row.outputTokens += u.outputTokens;
      row.fermentationCount += u.fermentationCount;
    }
    for (const u of data.estimated.ocr.byUser) {
      const row = userOf(u.userId, u.email);
      row.estimatedCostUsd += u.estimatedCostUsd;
      row.inputTokens += u.inputTokens;
      row.outputTokens += u.outputTokens;
      row.ocrCount += u.requestCount;
    }
    return Array.from(byUser.values()).sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd);
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
                推定コスト (Oryzae 記録分)
              </p>
              <p className="text-3xl font-semibold tracking-tight mt-0.5 tabular-nums">
                {formatUsd(data.estimated.totalCostUsd)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                発酵 {formatUsd(data.estimated.fermentation.totalCostUsd)} / OCR{' '}
                {data.estimated.ocr.status === 'error'
                  ? '取得失敗'
                  : formatUsd(data.estimated.ocr.totalCostUsd)}
              </p>
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
                  : '(推定 − 実請求) ÷ 実請求。実請求は org 全体なので通常マイナス'}
              </p>
            </div>
          </div>

          {/* 用途別の内訳。単価が違うので分けて出す（発酵 $3/$15、OCR $5/$25）。
              「OCR だけで幾らかかったか」はここで読む。 */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <div className="rounded-lg border border-border/50 bg-card p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">発酵 (推定)</p>
              <p className="text-2xl font-semibold tracking-tight mt-0.5 tabular-nums">
                {formatUsd(data.estimated.fermentation.totalCostUsd)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {data.estimated.fermentation.fermentationCount} 発酵 / in{' '}
                {data.estimated.fermentation.inputTokens.toLocaleString()} · out{' '}
                {data.estimated.fermentation.outputTokens.toLocaleString()}
              </p>
              <EstimateBasis
                pricing={data.estimated.fermentation.pricing}
                inputTokens={data.estimated.fermentation.inputTokens}
                outputTokens={data.estimated.fermentation.outputTokens}
              />
            </div>

            <div className="rounded-lg border border-border/50 bg-card p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">OCR (推定)</p>
              {data.estimated.ocr.status === 'error' ? (
                <>
                  <p className="text-2xl font-semibold tracking-tight mt-0.5 text-muted-foreground">
                    取得失敗
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    ocr_usage を読めませんでした（migration 00023 未適用の可能性）
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-semibold tracking-tight mt-0.5 tabular-nums">
                    {formatUsd(data.estimated.ocr.totalCostUsd)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {data.estimated.ocr.requestCount} 回 / in{' '}
                    {data.estimated.ocr.inputTokens.toLocaleString()} · out{' '}
                    {data.estimated.ocr.outputTokens.toLocaleString()}
                  </p>
                  <EstimateBasis
                    pricing={data.estimated.ocr.pricing}
                    inputTokens={data.estimated.ocr.inputTokens}
                    outputTokens={data.estimated.ocr.outputTokens}
                  />
                  {/* 実際に使われたモデル。価格表に無いものは金額を出せていないので明示する。 */}
                  {data.estimated.ocr.byModel.length > 0 && (
                    <div className="mt-2 space-y-0.5 text-xs text-muted-foreground font-mono tabular-nums">
                      {data.estimated.ocr.byModel.map((m) => (
                        <p key={m.model}>
                          {m.model} · {m.requestCount} 回 ·{' '}
                          {m.unpriced ? '単価不明（未計上）' : formatUsd(m.estimatedCostUsd)}
                        </p>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {(data.estimated.fermentation.untrackedCount > 0 ||
            data.estimated.ocr.untrackedCount > 0 ||
            data.estimated.truncated ||
            data.estimated.status !== 'ok') && (
            <div className="rounded-md bg-yellow-500/10 px-4 py-3 text-xs text-yellow-600 dark:text-yellow-500 space-y-1">
              {data.estimated.status === 'partial' && (
                <p>OCR を集計できていないため、推定合計は過少です。</p>
              )}
              {data.estimated.status === 'error' && (
                <p>発酵の集計に失敗しました。推定合計は当てになりません。</p>
              )}
              {data.estimated.fermentation.untrackedCount > 0 && (
                <p>
                  トークン未保存のため推定に含められなかった発酵が{' '}
                  {data.estimated.fermentation.untrackedCount} 件あります（推定は過少です）。
                </p>
              )}
              {data.estimated.ocr.untrackedCount > 0 && (
                <p>
                  価格表に無いモデルで実行された OCR が {data.estimated.ocr.untrackedCount}{' '}
                  件あります（金額を出せていません）。
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
                    <span className="w-14 text-right text-xs text-muted-foreground shrink-0 tabular-nums">
                      {d.fermentationCount}/{d.ocrCount}
                    </span>
                  </div>
                ))}
                <div className="flex items-center gap-3 pt-1 text-[10px] text-muted-foreground">
                  <span className="w-10 shrink-0" />
                  <span className="flex-1" />
                  <span className="w-20 text-right shrink-0">実請求</span>
                  <span className="w-20 text-right shrink-0">推定</span>
                  <span className="w-14 text-right shrink-0">発酵/OCR</span>
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
              はアプリのユーザーを識別しないため、この内訳は保存トークンからの推定です。発酵と OCR
              を合算しています。
            </p>
            {mergedUsers.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead className="text-right">発酵数</TableHead>
                      <TableHead className="text-right">OCR</TableHead>
                      <TableHead className="text-right">Input</TableHead>
                      <TableHead className="text-right">Output</TableHead>
                      <TableHead className="text-right">推定コスト</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mergedUsers.map((u) => (
                      <TableRow key={u.userId}>
                        <TableCell className="text-xs">
                          {u.email || `${u.userId.slice(0, 12)}...`}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {u.fermentationCount}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{u.ocrCount}</TableCell>
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
