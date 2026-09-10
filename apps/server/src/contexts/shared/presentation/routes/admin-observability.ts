import type { SupabaseClient } from '@supabase/supabase-js';
import { Hono } from 'hono';
import { z } from 'zod';
import { type ActualCostResult, fetchActualCost } from '../../infrastructure/anthropic-cost-api.js';
import {
  FERMENTATION_MODEL_ID,
  FERMENTATION_MODEL_RATE,
  featureOfModel,
} from '../../infrastructure/claude-pricing.js';
import {
  aggregateCost,
  aggregateCostByDay,
  fetchFermentationCostRows,
  resolveUserEmails,
} from '../../infrastructure/fermentation-cost-query.js';

type Env = {
  Variables: {
    adminUserId: string;
    adminSupabase: SupabaseClient;
  };
};

// 外部 API のレスポンスは信用せず、必要な形だけを実行時に検証して取り出す。
const vercelLatestDeploySchema = z.object({
  deployments: z.array(z.object({ state: z.string() })),
});

const resendEmailsSchema = z.object({
  data: z.array(
    z.object({
      created_at: z.string().optional(),
      last_event: z.string().optional(),
    }),
  ),
});

const upstashDbSizeSchema = z.object({ result: z.number() });

const vercelDeployListSchema = z.object({
  deployments: z.array(
    z.object({
      uid: z.string().optional(),
      state: z.string().optional(),
      target: z.string().optional(),
      created: z.number().optional(),
      buildingAt: z.number().optional(),
      ready: z.number().optional(),
      url: z.string().optional(),
      inspectorUrl: z.string().optional(),
      meta: z
        .object({
          githubCommitMessage: z.string().optional(),
          githubCommitRef: z.string().optional(),
        })
        .optional(),
      creator: z.object({ email: z.string().optional() }).optional(),
    }),
  ),
});

/**
 * モデル ID → Oryzae での用途。
 *
 * Anthropic は「用途」を知らない。モデルが分かれているから用途別に読めるだけで、
 * **同じモデルを他の用途や CI が使えば同じバケットに混ざる**。だから返すのは
 * 「このモデルを使っている機能」であって「その機能のコード」ではない。
 * 画面・通知の文言もそのつもりで書くこと。
 */

// ── Summary (hub page) ──────────────────────────────────

async function getSentryCount(): Promise<number | null> {
  const authToken = process.env.SENTRY_AUTH_TOKEN;
  const org = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT;
  if (!authToken || !org || !project) return null;
  try {
    const res = await fetch(
      `https://sentry.io/api/0/projects/${org}/${project}/issues/?query=is:unresolved&limit=100`,
      { headers: { Authorization: `Bearer ${authToken}` }, signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;
    const body: unknown = await res.json();
    return Array.isArray(body) ? body.length : null;
  } catch {
    return null;
  }
}

/**
 * 今月の実請求額 (Anthropic cost_report)。
 *
 * 旧実装は Vercel AI Gateway の getSpendReport / getCredits を叩いていたが、
 * issue #352 で Anthropic 直叩きに切替えて以降 Gateway 経由の実績はゼロで、
 * 画面には常に $0.0000 と空のチャートが出ていた（実際には課金されている）。
 * クレジット残高は Gateway 固有の概念なので廃止した。
 */
async function getMonthToDateActual(): Promise<ActualCostResult> {
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return fetchActualCost(startOfMonth, now);
}

async function getVercelLatestDeploy(): Promise<string | null> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch('https://api.vercel.com/v6/deployments?limit=1&target=production', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const parsed = vercelLatestDeploySchema.safeParse(await res.json());
    if (!parsed.success) return null;
    return parsed.data.deployments[0]?.state ?? null;
  } catch {
    return null;
  }
}

async function getResendStats(): Promise<{ sentCount: number; bouncedCount: number } | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch('https://api.resend.com/emails?limit=100', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const parsed = resendEmailsSchema.safeParse(await res.json());
    if (!parsed.success) return null;
    const data = parsed.data.data;

    const sevenDaysAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let sentCount = 0;
    let bouncedCount = 0;
    for (const email of data) {
      if (!email.created_at) continue;
      const ts = new Date(email.created_at).getTime();
      if (Number.isNaN(ts) || ts < sevenDaysAgoMs) continue;
      sentCount++;
      if (email.last_event === 'bounced') bouncedCount++;
    }
    return { sentCount, bouncedCount };
  } catch {
    return null;
  }
}

async function getUpstashKeyCount(): Promise<number | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}/dbsize`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const parsed = upstashDbSizeSchema.safeParse(await res.json());
    return parsed.success ? parsed.data.result : null;
  } catch {
    return null;
  }
}

export const adminObservability = new Hono<Env>()
  .get('/summary', async (c) => {
    const [sentryCount, monthlyActual, vercelDeploy, upstashKeys, resendStats] = await Promise.all([
      getSentryCount(),
      getMonthToDateActual(),
      getVercelLatestDeploy(),
      getUpstashKeyCount(),
      getResendStats(),
    ]);

    return c.json({
      posthog: { metric: null }, // fetched client-side from /analytics/overview
      sentry: {
        unresolvedCount: sentryCount,
      },
      anthropic: {
        // status を必ず返す。null と 0 を潰すと「未設定」を「$0」と誤読させる。
        status: monthlyActual.kind,
        monthlySpend: monthlyActual.kind === 'ok' ? monthlyActual.totalCostUsd : null,
        message: monthlyActual.kind === 'error' ? monthlyActual.message : null,
      },
      resend: {
        sentCount7d: resendStats?.sentCount ?? null,
        bouncedCount7d: resendStats?.bouncedCount ?? null,
      },
      upstash: {
        totalKeys: upstashKeys,
      },
      vercel: {
        latestDeployState: vercelDeploy,
      },
    });
  })

  // ── Sentry issues detail ─────────────────────────────
  .get('/errors', async (c) => {
    const authToken = process.env.SENTRY_AUTH_TOKEN;
    const org = process.env.SENTRY_ORG;
    const project = process.env.SENTRY_PROJECT;
    if (!authToken || !org || !project) {
      return c.json({ issues: [], configured: false });
    }

    try {
      const res = await fetch(
        `https://sentry.io/api/0/projects/${org}/${project}/issues/?query=is:unresolved&limit=25&sort=date`,
        { headers: { Authorization: `Bearer ${authToken}` }, signal: AbortSignal.timeout(5000) },
      );
      if (!res.ok) return c.json({ issues: [], configured: true });

      const body: unknown = await res.json();
      if (!Array.isArray(body)) return c.json({ issues: [], configured: true });

      interface SentryIssue {
        title?: string;
        shortId?: string;
        level?: string;
        count?: string;
        userCount?: number;
        firstSeen?: string;
        lastSeen?: string;
        permalink?: string;
      }

      const issues = body.map((issue: SentryIssue) => ({
        title: issue.title ?? '',
        shortId: issue.shortId ?? '',
        level: issue.level ?? 'error',
        count: Number(issue.count ?? 0),
        userCount: issue.userCount ?? 0,
        firstSeen: issue.firstSeen ?? '',
        lastSeen: issue.lastSeen ?? '',
        permalink: issue.permalink ?? '',
      }));

      return c.json({ issues, configured: true });
    } catch {
      return c.json({ issues: [], configured: true });
    }
  })

  // ── AI spend detail ───────────────────────────────────
  // 実請求額 (Anthropic cost_report) と 推定 (自前トークン × 価格表) を明確に分けて返す。
  //
  // **用途別の内訳は実額側で出す。** cost_report を group_by[]=description で取ると
  // モデル別に割れ、Oryzae は用途ごとに別モデルを使っている（発酵 = sonnet-4-6、
  // OCR = opus-5）ので、モデル別内訳がそのまま用途別の実額になる。推定しない。
  //
  // 推定が残っているのは **ユーザー別内訳** のためだけ。Anthropic は Oryzae の
  // ユーザーを知らないので、その軸だけは実額で出せない。
  //
  // 日別は両者を突き合わせられるよう UTC 日で揃える（cost_report が UTC 固定のため）。
  .get('/spend', async (c) => {
    const supabase = c.get('adminSupabase');
    const daysBackParam = Number(c.req.query('date_from') ?? '30');
    const daysBack = Number.isFinite(daysBackParam) && daysBackParam > 0 ? daysBackParam : 30;

    const now = new Date();
    const start = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

    const [actual, rowsResult] = await Promise.all([
      fetchActualCost(start, now),
      fetchFermentationCostRows(supabase, {
        startIso: start.toISOString(),
        endIso: now.toISOString(),
      }).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[admin-observability] spend query failed', { error: message });
        return null;
      }),
    ]);

    const rows = rowsResult?.rows ?? [];
    const aggregate = aggregateCost(rows);
    // 日別は UTC 日で切る。同じ画面に並ぶ Anthropic 実額が UTC 日バケット固定で、
    // 窓を揃えないと乖離が読めないため（日次レポートは運用に合わせ JST 日。
    // cron-cost-alert.ts 参照）。画面には「UTC 日」と明記している。
    const daily = aggregateCostByDay(rows, (createdAt) => createdAt.slice(0, 10));
    // resolveUserEmails は listUsers を最大20往復する。解決すべきユーザーが
    // 居ない（期間内に発酵ゼロ / クエリ失敗）ときに叩く意味はない。
    const emailMap =
      aggregate.byUser.length > 0 ? await resolveUserEmails(supabase) : new Map<string, string>();

    return c.json({
      rangeDays: daysBack,
      actual: {
        status: actual.kind,
        totalCostUsd: actual.kind === 'ok' ? actual.totalCostUsd : null,
        daily: actual.kind === 'ok' ? actual.daily : [],
        // モデル別の実額。どのモデルがどの用途かは feature で添える。
        // Anthropic は「用途」を知らないので、対応付けはこちらの知識。
        byModel:
          actual.kind === 'ok'
            ? actual.byModel.map((m) => ({
                model: m.model,
                costUsd: m.costUsd,
                byTokenType: m.byTokenType,
                feature: featureOfModel(m.model),
              }))
            : [],
        // 内訳が返らなかった場合 true。総額は正しいまま内訳だけ消えるので、
        // 空配列を「内訳ゼロ」と読ませないために別途返す。
        groupingUnavailable: actual.kind === 'ok' ? actual.groupingUnavailable : false,
        // truncated は status === 'ok' のときだけ意味を持つ。失敗時の false は
        // 「完全に取得できた」ではなく「該当なし」。必ず status を先に見ること。
        truncated: actual.kind === 'ok' ? actual.truncated : false,
        message: actual.kind === 'error' ? actual.message : null,
      },
      estimated: {
        // rowsResult が null = クエリ失敗。空配列を「コスト0」と読ませないため status を返す。
        status: rowsResult === null ? 'error' : 'ok',
        // 推定の計算根拠。画面で「どう出した数字か」を検算できるように返す。
        // 単価は claude-pricing.ts が唯一の正なので、フロントでハードコードしない。
        pricing: {
          modelId: FERMENTATION_MODEL_ID,
          inputUsdPerMTok: FERMENTATION_MODEL_RATE.inputUsdPerMTok,
          outputUsdPerMTok: FERMENTATION_MODEL_RATE.outputUsdPerMTok,
        },
        totalCostUsd: aggregate.estimatedCostUsd,
        inputTokens: aggregate.inputTokens,
        outputTokens: aggregate.outputTokens,
        fermentationCount: aggregate.fermentationCount,
        untrackedCount: aggregate.untrackedCount,
        truncated: rowsResult?.truncated ?? false,
        daily,
        byUser: aggregate.byUser.map((u) => ({
          userId: u.userId,
          email: emailMap.get(u.userId) ?? '',
          estimatedCostUsd: u.estimatedCostUsd,
          inputTokens: u.inputTokens,
          outputTokens: u.outputTokens,
          fermentationCount: u.fermentationCount,
        })),
      },
    });
  })

  // ── Vercel deploys detail ─────────────────────────────
  .get('/deploys', async (c) => {
    const token = process.env.VERCEL_TOKEN;
    if (!token) return c.json({ deploys: [], configured: false });

    try {
      const res = await fetch('https://api.vercel.com/v6/deployments?limit=20', {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return c.json({ deploys: [], configured: true });

      const parsed = vercelDeployListSchema.safeParse(await res.json());
      if (!parsed.success) {
        return c.json({ deploys: [], configured: true });
      }

      const deploys = parsed.data.deployments.map((d) => ({
        id: d.uid ?? '',
        state: d.state ?? '',
        target: d.target ?? '',
        createdAt: d.created ? new Date(d.created).toISOString() : '',
        buildDurationMs: d.ready && d.buildingAt ? d.ready - d.buildingAt : null,
        url: d.url ?? '',
        inspectorUrl: d.inspectorUrl ?? '',
        commitMessage: d.meta?.githubCommitMessage ?? '',
        commitRef: d.meta?.githubCommitRef ?? '',
        creatorEmail: d.creator?.email ?? '',
      }));

      return c.json({ deploys, configured: true });
    } catch {
      return c.json({ deploys: [], configured: true });
    }
  });
