import type { SupabaseClient } from '@supabase/supabase-js';
import { Hono } from 'hono';
import { z } from 'zod';
import { type ActualCostResult, fetchActualCost } from '../../infrastructure/anthropic-cost-api.js';
import {
  FERMENTATION_MODEL_ID,
  FERMENTATION_MODEL_RATE,
  OCR_MODEL_ID,
  OCR_MODEL_RATE,
} from '../../infrastructure/claude-pricing.js';
import {
  aggregateCost,
  aggregateCostByDay,
  fetchFermentationCostRows,
  resolveUserEmails,
} from '../../infrastructure/fermentation-cost-query.js';
import {
  aggregateOcrCost,
  aggregateOcrCostByDay,
  fetchOcrUsageRows,
} from '../../infrastructure/ocr-cost-query.js';

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
  // 推定はさらに 発酵 / OCR に割る。単価が違う（発酵 claude-sonnet-4-6 $3/$15、
  // OCR claude-opus-5 $5/$25）ので合算してから一律単価は掛けられないし、
  // 「OCR だけで幾らか」を見るためでもある。
  //
  // Anthropic 側は Oryzae のユーザーを知らないため、ユーザー別内訳は推定のみ。
  // 日別は両者を突き合わせられるよう UTC 日で揃える（cost_report が UTC 固定のため）。
  .get('/spend', async (c) => {
    const supabase = c.get('adminSupabase');
    const daysBackParam = Number(c.req.query('date_from') ?? '30');
    const daysBack = Number.isFinite(daysBackParam) && daysBackParam > 0 ? daysBackParam : 30;

    const now = new Date();
    const start = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    const startIso = start.toISOString();
    const endIso = now.toISOString();

    const [actual, rowsResult, ocrRowsResult] = await Promise.all([
      fetchActualCost(start, now),
      fetchFermentationCostRows(supabase, { startIso, endIso }).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[admin-observability] spend query failed', { error: message });
        return null;
      }),
      // migration 00023 未適用の環境ではテーブルが無い。0 件（$0）と区別するため
      // null を返し、status で「取得できていない」と伝える。
      fetchOcrUsageRows(supabase, { startIso, endIso }).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[admin-observability] ocr usage query failed', { error: message });
        return null;
      }),
    ]);

    const rows = rowsResult?.rows ?? [];
    const aggregate = aggregateCost(rows);
    const ocrRows = ocrRowsResult?.rows ?? [];
    const ocrAggregate = aggregateOcrCost(ocrRows);

    // 日別は UTC 日で切る。同じ画面に並ぶ Anthropic 実額が UTC 日バケット固定で、
    // 窓を揃えないと乖離が読めないため（日次レポートは運用に合わせ JST 日。
    // cron-cost-alert.ts 参照）。画面には「UTC 日」と明記している。
    const toUtcDateKey = (createdAt: string) => createdAt.slice(0, 10);
    const daily = aggregateCostByDay(rows, toUtcDateKey);
    const ocrDaily = aggregateOcrCostByDay(ocrRows, toUtcDateKey);

    // resolveUserEmails は listUsers を最大20往復する。解決すべきユーザーが
    // 居ない（期間内に利用ゼロ / クエリ失敗）ときに叩く意味はない。
    const needsEmails = aggregate.byUser.length > 0 || ocrAggregate.byUser.length > 0;
    const emailMap = needsEmails ? await resolveUserEmails(supabase) : new Map<string, string>();

    // 片方だけ取れた状態を「ok」と言わない。合計が過少なのに完全なように見える。
    const estimatedStatus =
      rowsResult === null ? 'error' : ocrRowsResult === null ? 'partial' : 'ok';

    return c.json({
      rangeDays: daysBack,
      actual: {
        status: actual.kind,
        totalCostUsd: actual.kind === 'ok' ? actual.totalCostUsd : null,
        daily: actual.kind === 'ok' ? actual.daily : [],
        // truncated は status === 'ok' のときだけ意味を持つ。失敗時の false は
        // 「完全に取得できた」ではなく「該当なし」。必ず status を先に見ること。
        truncated: actual.kind === 'ok' ? actual.truncated : false,
        message: actual.kind === 'error' ? actual.message : null,
      },
      estimated: {
        // 'ok' = 両方取れた / 'partial' = OCR だけ取れていない / 'error' = 発酵が取れていない。
        // 空配列を「コスト0」と読ませないため必ず status を先に見ること。
        status: estimatedStatus,
        /** 発酵 + OCR。実請求額と突き合わせる相手はこの合計。 */
        totalCostUsd: aggregate.estimatedCostUsd + ocrAggregate.estimatedCostUsd,
        truncated: (rowsResult?.truncated ?? false) || (ocrRowsResult?.truncated ?? false),
        fermentation: {
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
        ocr: {
          status: ocrRowsResult === null ? 'error' : 'ok',
          pricing: {
            modelId: OCR_MODEL_ID,
            inputUsdPerMTok: OCR_MODEL_RATE.inputUsdPerMTok,
            outputUsdPerMTok: OCR_MODEL_RATE.outputUsdPerMTok,
          },
          totalCostUsd: ocrAggregate.estimatedCostUsd,
          inputTokens: ocrAggregate.inputTokens,
          outputTokens: ocrAggregate.outputTokens,
          requestCount: ocrAggregate.requestCount,
          untrackedCount: ocrAggregate.untrackedCount,
          truncated: ocrRowsResult?.truncated ?? false,
          daily: ocrDaily,
          // 実際に使われたモデルと単価。価格表に無いモデルは unpriced=true で
          // 「金額を出せていない」ことを隠さない。
          byModel: ocrAggregate.byModel,
          byUser: ocrAggregate.byUser.map((u) => ({
            userId: u.userId,
            email: emailMap.get(u.userId) ?? '',
            estimatedCostUsd: u.estimatedCostUsd,
            inputTokens: u.inputTokens,
            outputTokens: u.outputTokens,
            requestCount: u.requestCount,
          })),
        },
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
