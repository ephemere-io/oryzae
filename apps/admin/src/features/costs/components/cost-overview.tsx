'use client';

import { ExternalLink, RefreshCw } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
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
import { type AiFeature, type CostsData, useCosts } from '../hooks/use-costs';

/**
 * 「コスト」ページ。答える問いは 2 つだけ:
 *   ① いくら払ったか（Anthropic の実額。Workspace 別・日別）
 *   ② 誰がどれだけ使ったか（ai_usage。回数・トークン・推定額）
 *
 * 期間は UTC 日で切る（cost_report のバケットが UTC 日固定）。見出しには JST の時刻範囲を出す。
 */

const FEATURES: readonly AiFeature[] = ['fermentation', 'ocr_board', 'ocr_entry'];

const FEATURE_LABEL: Record<AiFeature, string> = {
  fermentation: '発酵',
  ocr_board: 'ボード OCR',
  ocr_entry: '写真の文字起こし',
};

type Preset = 'yesterday' | '7d' | '30d' | 'this-month' | 'last-month' | 'custom';

const PRESETS: { key: Preset; label: string; hint: string }[] = [
  { key: 'yesterday', label: '昨日', hint: '日次レポートと同じ 1 日' },
  { key: '7d', label: '7日', hint: '今日を含む直近 7 日' },
  { key: '30d', label: '30日', hint: '今日を含む直近 30 日' },
  { key: 'this-month', label: '今月', hint: '月初から今日まで' },
  { key: 'last-month', label: '先月', hint: '先月 1 か月' },
  { key: 'custom', label: '日付指定', hint: '' },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function utcKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** プリセットを UTC 日の範囲に直す。'this-month' は null（= サーバーの既定 = 今月）。 */
function rangeOf(
  preset: Preset,
  custom: { from: string; to: string },
): { from: string; to: string } | null {
  const now = new Date();
  if (preset === 'this-month') return null;
  if (preset === 'yesterday') {
    const key = utcKey(new Date(now.getTime() - DAY_MS));
    return { from: key, to: key };
  }
  if (preset === '7d') {
    return { from: utcKey(new Date(now.getTime() - 6 * DAY_MS)), to: utcKey(now) };
  }
  if (preset === 'last-month') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    return { from: utcKey(start), to: utcKey(end) };
  }
  if (preset === '30d') {
    return { from: utcKey(new Date(now.getTime() - 29 * DAY_MS)), to: utcKey(now) };
  }
  return custom;
}

function usd(value: number): string {
  if (value === 0) return '$0';
  return Math.abs(value) >= 1 ? `$${value.toFixed(2)}` : `$${value.toFixed(4)}`;
}

function tok(value: number): string {
  return value.toLocaleString('en-US');
}

/** 前の期間との差。「前の期間 $20.00（+25%）」 */
function versus(current: number, previous: number | null): string | null {
  if (previous === null) return null;
  if (previous === 0) return current === 0 ? '±0' : '前の期間は $0';
  const pct = Math.round(((current - previous) / previous) * 100);
  return `${pct >= 0 ? '+' : ''}${pct}%`;
}

function shortDate(key: string): string {
  const [, m, d] = key.split('-');
  return m && d ? `${Number(m)}/${Number(d)}` : key;
}

function ConsoleLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 underline hover:text-foreground"
    >
      Anthropic Console
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border/50 bg-card p-4 space-y-4">
      <div>
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
      </div>
      {children}
    </section>
  );
}

/** ① いくら払ったか */
function ActualSection({ data }: { data: CostsData }) {
  const { actual, consoleUrl } = data;
  const note = (
    <>
      Anthropic が請求した額（Workspace 別）。数字は <ConsoleLink href={consoleUrl} /> と同じ UTC
      日で並んでいます。
    </>
  );

  if (actual.status !== 'ok') {
    return (
      <Section title="① いくら払ったか" note={note}>
        <p className="text-sm text-muted-foreground">
          {actual.status === 'not-configured'
            ? '取得できません（ANTHROPIC_ADMIN_KEY 未設定）'
            : `取得できません: ${actual.message}`}
        </p>
      </Section>
    );
  }

  const maxDay = Math.max(...actual.daily.map((d) => d.costUsd), 0.000001);
  return (
    <Section title="① いくら払ったか" note={note}>
      <div>
        <p className="text-3xl font-semibold tracking-tight tabular-nums">{usd(actual.totalUsd)}</p>
        {actual.previousTotalUsd !== null && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            前の期間（{actual.previousPeriodLabel}）{usd(actual.previousTotalUsd)}
            <span className="ml-1 font-medium text-foreground">
              {versus(actual.totalUsd, actual.previousTotalUsd)}
            </span>
          </p>
        )}
        {actual.projection && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            月末までの見込み {usd(actual.projection.projectedUsd)}（{actual.projection.daysElapsed}{' '}
            日の平均 × {actual.projection.daysInMonth} 日）
          </p>
        )}
        {actual.truncated && (
          <p className="mt-0.5 text-xs text-destructive">
            集計を打ち切ったため、実際より少なく出ています
          </p>
        )}
      </div>

      <div className="space-y-2">
        {actual.byWorkspace.map((w) => (
          <div key={w.name}>
            <div className="flex items-baseline gap-3 text-sm">
              <span className="flex-1 truncate font-medium">
                {w.name}
                {w.outsideOryzae && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    Oryzae 外の利用
                  </span>
                )}
              </span>
              <span className="w-16 text-right text-xs text-muted-foreground tabular-nums">
                {versus(w.costUsd, w.previousCostUsd) ?? ''}
              </span>
              <span className="w-20 text-right font-mono tabular-nums">{usd(w.costUsd)}</span>
            </div>
            {w.keys.map((k) => (
              <div
                key={k.label}
                className="flex items-baseline gap-3 pl-4 text-xs text-muted-foreground"
              >
                <span className="flex-1 truncate">キー {k.label}</span>
                <span className="font-mono tabular-nums">
                  {k.inputTokens + k.outputTokens === 0
                    ? '0 tok'
                    : `入 ${tok(k.inputTokens)} / 出 ${tok(k.outputTokens)} tok`}
                  {k.cacheTokens > 0 && `（うちキャッシュ ${tok(k.cacheTokens)}）`}
                </span>
              </div>
            ))}
          </div>
        ))}
        <p className="text-[11px] text-muted-foreground">
          金額は Workspace 単位。キーの行はトークン数（Anthropic は金額をキー別に割らない）。
        </p>
      </div>

      {actual.daily.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">日別</p>
          {actual.daily.map((d) => (
            <div key={d.date} className="flex items-center gap-3 text-sm">
              <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">
                {shortDate(d.date)}
              </span>
              <div className="h-3 flex-1 overflow-hidden rounded-sm bg-muted/30">
                <div
                  className="h-full rounded-sm bg-primary/60"
                  style={{ width: `${(d.costUsd / maxDay) * 100}%` }}
                />
              </div>
              <span className="w-20 shrink-0 text-right font-mono text-xs tabular-nums">
                {usd(d.costUsd)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

/** ② 誰がどれだけ使ったか */
function UsageSection({ data }: { data: CostsData }) {
  const { usage } = data;
  const note =
    'Oryzae が AI を使うたびに残している記録（ai_usage）。金額はトークン × 単価の推定で、Anthropic の実額とは一致しないことがあります。';

  if (usage.status !== 'ok') {
    return (
      <Section title="② 誰がどれだけ使ったか" note={note}>
        <p className="text-sm text-muted-foreground">記録を取得できません: {usage.message}</p>
      </Section>
    );
  }

  return (
    <Section title="② 誰がどれだけ使ったか" note={note}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>機能</TableHead>
            <TableHead className="text-right">AI を使った回数</TableHead>
            <TableHead className="text-right">人数</TableHead>
            <TableHead className="text-right">入力 / 出力 tok</TableHead>
            <TableHead className="text-right">推定額</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usage.features.map((f) => (
            <TableRow key={f.feature}>
              <TableCell>
                {FEATURE_LABEL[f.feature]}
                {f.outcomes && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    発酵 {f.outcomes.total} 件（成功 {f.outcomes.completed} / 失敗{' '}
                    {f.outcomes.failed}）
                  </span>
                )}
                <span
                  className="ml-2 text-xs text-muted-foreground"
                  title={`入力 $${f.rate.inputUsdPerMTok} / 出力 $${f.rate.outputUsdPerMTok}（100 万トークンあたり）`}
                >
                  {f.model}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">{f.count}</TableCell>
              <TableCell className="text-right tabular-nums">{f.userCount}</TableCell>
              <TableCell className="text-right font-mono text-xs tabular-nums">
                {tok(f.inputTokens)} / {tok(f.outputTokens)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {usd(f.estimatedUsd)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div>
        <p className="mb-1 text-xs text-muted-foreground">ユーザー別（推定額の多い順）</p>
        {usage.users.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            この期間の利用はありません
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ユーザー</TableHead>
                <TableHead>使った機能</TableHead>
                <TableHead className="text-right">入力 / 出力 tok</TableHead>
                <TableHead className="text-right">推定額</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usage.users.map((u) => (
                <TableRow key={u.userId}>
                  <TableCell className="max-w-64 truncate">{u.label}</TableCell>
                  <TableCell className="text-xs">
                    {FEATURES.filter((f) => u.counts[f] > 0)
                      .map((f) => `${FEATURE_LABEL[f]} ${u.counts[f]}`)
                      .join('・')}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {tok(u.inputTokens)} / {tok(u.outputTokens)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {usd(u.estimatedUsd)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {usage.truncated && (
          <p className="mt-1 text-xs text-destructive">記録が多すぎて途中までしか読めていません</p>
        )}
      </div>
    </Section>
  );
}

function CostSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-busy="true" aria-label="コストを読み込み中">
      {['actual', 'usage'].map((key) => (
        <div key={key} className="space-y-3 rounded-lg border border-border/50 bg-card p-4">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}

export function CostOverview() {
  const [preset, setPreset] = useState<Preset>('this-month');
  const today = utcKey(new Date());
  const [custom, setCustom] = useState({ from: `${today.slice(0, 8)}01`, to: today });
  const range = useMemo(() => rangeOf(preset, custom), [preset, custom]);
  const { data, loading, error, refresh } = useCosts(range);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium">コスト</h1>
          <p className="text-xs text-muted-foreground">{data ? `${data.period.label}` : ' '}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-border text-xs">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPreset(p.key)}
                title={p.hint}
                className={`px-2.5 py-1 ${preset === p.key ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="flex items-center gap-1 text-xs">
              <input
                type="date"
                value={custom.from}
                max={custom.to}
                onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                className="h-7 rounded-md border border-border bg-transparent px-2"
                aria-label="開始日（UTC）"
              />
              〜
              <input
                type="date"
                value={custom.to}
                min={custom.from}
                max={today}
                onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                className="h-7 rounded-md border border-border bg-transparent px-2"
                aria-label="終了日（UTC）"
              />
            </div>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={refresh}
            disabled={loading}
            aria-label="再読み込み"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && !data ? (
        <CostSkeleton />
      ) : data ? (
        <>
          <ActualSection data={data} />
          <UsageSection data={data} />
        </>
      ) : null}
    </div>
  );
}
