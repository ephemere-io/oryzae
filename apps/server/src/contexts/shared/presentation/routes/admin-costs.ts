import type { SupabaseClient } from '@supabase/supabase-js';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AiFeature } from '../../domain/gateways/ai-usage-recorder.gateway.js';
import { fetchAiUsage } from '../../infrastructure/ai-usage-query.js';
import {
  ANTHROPIC_COST_CONSOLE_URL,
  fetchActualCost,
  listWorkspaces,
} from '../../infrastructure/anthropic-cost-api.js';
import { estimateFeatureCostUsd, featureRate } from '../../infrastructure/claude-pricing.js';
import { jstTimeRange, toUtcDateKey, utcMonthBounds } from '../../infrastructure/jst-day.js';
import { resolveUserLabels } from '../../infrastructure/user-labels.js';
import { buildWorkspaceRows } from '../helpers/cost-report-workspaces.js';

/**
 * 管理画面「コスト」ページの API。答える問いは 2 つだけ:
 *
 *   ① いくら払ったか — Anthropic の cost_report（実額）。Workspace 別・日別
 *   ② 誰がどれだけ使ったか — ai_usage（回数・トークン）と、トークン × 単価の推定額
 *
 * 期間は UTC 日で切り、表示は JST の時刻範囲で書く（日次レポートと同じ切り方）。
 * cost_report のバケットが UTC 日固定なので、①と②を同じ窓で並べるにはこれしかない。
 */

type Env = {
  Variables: {
    adminUserId: string;
    adminSupabase: SupabaseClient;
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 366;
const FEATURES: readonly AiFeature[] = ['fermentation', 'ocr_board', 'ocr_entry'];

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const querySchema = z.object({ from: dateKey.optional(), to: dateKey.optional() });

function startOfUtcDay(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

const round6 = (n: number) => Math.round(n * 1_000_000) / 1_000_000;

export const adminCosts = new Hono<Env>().get('/', async (c) => {
  const parsed = querySchema.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: 'from / to は YYYY-MM-DD（UTC 日）で指定する' }, 400);

  const now = new Date();
  const today = toUtcDateKey(now);
  // 既定は今月（UTC 月初〜今日）。
  const from = parsed.data.from ?? `${today.slice(0, 8)}01`;
  const to = parsed.data.to ?? today;
  const start = startOfUtcDay(from);
  const endExclusive = new Date(startOfUtcDay(to).getTime() + DAY_MS);
  if (endExclusive <= start) return c.json({ error: 'to は from 以降の日付にする' }, 400);
  if (endExclusive.getTime() - start.getTime() > MAX_RANGE_DAYS * DAY_MS) {
    return c.json({ error: `期間は ${MAX_RANGE_DAYS} 日以内にする` }, 400);
  }
  // 未来は読まない（まだ起きていないので 0 と同じだが、見込みの計算を狂わせる）。
  const end = endExclusive < now ? endExclusive : now;

  const supabase = c.get('adminSupabase');
  const [actual, workspaces, usage] = await Promise.all([
    fetchActualCost(start, end),
    listWorkspaces(),
    fetchAiUsage(supabase, {
      startIso: start.toISOString(),
      endIso: new Date(end.getTime() - 1).toISOString(),
    }),
  ]);

  // ① いくら払ったか
  let actualBody: unknown;
  if (actual.kind === 'ok') {
    const rows = buildWorkspaceRows({
      costByWorkspace: actual.byWorkspace,
      workspaces: Array.isArray(workspaces) ? workspaces : null,
      apiKeys: null,
      usageByKey: null,
    });
    // 見込みは「今月」を見ているときだけ。月の途中までの平均を月末まで延ばした単純な延長。
    const month = utcMonthBounds(from);
    const isCurrentMonth = from === toUtcDateKey(month.start) && endExclusive >= now;
    const daysElapsed = Math.floor((now.getTime() - month.start.getTime()) / DAY_MS);
    actualBody = {
      status: 'ok',
      totalUsd: round6(actual.totalCostUsd),
      byWorkspace: rows.map((r) => ({
        name: r.name,
        costUsd: round6(r.costUsd),
        /** Default Workspace には Oryzae のキーを置いていない。額が出たら Oryzae 外の利用。 */
        outsideOryzae: r.id === null,
      })),
      daily: actual.daily.map((d) => ({ date: d.date, costUsd: round6(d.costUsd) })),
      projection:
        isCurrentMonth && daysElapsed > 0
          ? {
              projectedUsd: round6((actual.totalCostUsd / daysElapsed) * month.daysInMonth),
              daysElapsed,
              daysInMonth: month.daysInMonth,
            }
          : null,
      truncated: actual.truncated,
    };
  } else {
    actualBody =
      actual.kind === 'error'
        ? { status: 'error', message: actual.message }
        : { status: 'not-configured' };
  }

  // ② 誰がどれだけ使ったか
  let usageBody: unknown;
  if (usage.kind === 'ok') {
    const features = FEATURES.map((feature) => {
      const agg = usage.byFeature[feature];
      const { model, rate } = featureRate(feature);
      return {
        feature,
        model,
        rate,
        count: agg.count,
        userCount: agg.byUser.length,
        inputTokens: agg.inputTokens,
        outputTokens: agg.outputTokens,
        estimatedUsd: round6(estimateFeatureCostUsd(feature, agg.inputTokens, agg.outputTokens)),
      };
    });

    const users = new Map<
      string,
      {
        userId: string;
        counts: Record<AiFeature, number>;
        inputTokens: number;
        outputTokens: number;
        estimatedUsd: number;
      }
    >();
    for (const feature of FEATURES) {
      for (const u of usage.byFeature[feature].byUser) {
        const row = users.get(u.userId) ?? {
          userId: u.userId,
          counts: { fermentation: 0, ocr_board: 0, ocr_entry: 0 },
          inputTokens: 0,
          outputTokens: 0,
          estimatedUsd: 0,
        };
        row.counts[feature] += u.count;
        row.inputTokens += u.inputTokens;
        row.outputTokens += u.outputTokens;
        row.estimatedUsd += estimateFeatureCostUsd(feature, u.inputTokens, u.outputTokens);
        users.set(u.userId, row);
      }
    }
    const labels = await resolveUserLabels(supabase, Array.from(users.keys()));
    usageBody = {
      status: 'ok',
      features,
      users: Array.from(users.values())
        .sort((a, b) => b.estimatedUsd - a.estimatedUsd)
        .map((u) => ({
          ...u,
          label: labels.get(u.userId) ?? u.userId.slice(0, 8),
          estimatedUsd: round6(u.estimatedUsd),
        })),
      truncated: usage.truncated,
    };
  } else {
    usageBody = { status: 'error', message: usage.message };
  }

  return c.json({
    period: { from, to, label: jstTimeRange(start, end) },
    actual: actualBody,
    usage: usageBody,
    consoleUrl: ANTHROPIC_COST_CONSOLE_URL,
  });
});
