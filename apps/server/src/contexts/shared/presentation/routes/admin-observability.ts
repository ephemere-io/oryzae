import type { SupabaseClient } from '@supabase/supabase-js';
import { gateway } from 'ai';
import { Hono } from 'hono';
import { z } from 'zod';

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

async function getGatewaySpend(): Promise<{ totalCost: number; requestCount: number } | null> {
  try {
    const now = new Date();
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const endDate = now.toISOString().slice(0, 10);
    const report = await gateway.getSpendReport({
      startDate: startOfMonth,
      endDate,
      tags: ['fermentation'],
    });
    let totalCost = 0;
    let requestCount = 0;
    for (const r of report.results) {
      totalCost += r.totalCost;
      requestCount += r.requestCount ?? 0;
    }
    return { totalCost, requestCount };
  } catch {
    return null;
  }
}

async function getGatewayCredits(): Promise<{ balance: string; totalUsed: string } | null> {
  try {
    return await gateway.getCredits();
  } catch {
    return null;
  }
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
    const [sentryCount, gatewaySpend, gatewayCredits, vercelDeploy, upstashKeys, resendStats] =
      await Promise.all([
        getSentryCount(),
        getGatewaySpend(),
        getGatewayCredits(),
        getVercelLatestDeploy(),
        getUpstashKeyCount(),
        getResendStats(),
      ]);

    return c.json({
      posthog: { metric: null }, // fetched client-side from /analytics/overview
      sentry: {
        unresolvedCount: sentryCount,
      },
      gateway: {
        monthlySpend: gatewaySpend?.totalCost ?? null,
        monthlyRequests: gatewaySpend?.requestCount ?? null,
        creditBalance: gatewayCredits?.balance ?? null,
        creditUsed: gatewayCredits?.totalUsed ?? null,
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

  // ── Gateway spend detail ──────────────────────────────
  .get('/spend', async (c) => {
    const dateFrom = c.req.query('date_from') ?? '30';
    const daysBack = Number(dateFrom);
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - daysBack);

    try {
      const [dailyReport, userReport, credits] = await Promise.all([
        gateway.getSpendReport({
          startDate: start.toISOString().slice(0, 10),
          endDate: now.toISOString().slice(0, 10),
          groupBy: 'day',
          tags: ['fermentation'],
        }),
        gateway.getSpendReport({
          startDate: start.toISOString().slice(0, 10),
          endDate: now.toISOString().slice(0, 10),
          groupBy: 'user',
          tags: ['fermentation'],
        }),
        gateway.getCredits(),
      ]);

      return c.json({
        daily: dailyReport.results.map((r) => ({
          date: r.day ?? '',
          totalCost: r.totalCost,
          inputTokens: r.inputTokens ?? 0,
          outputTokens: r.outputTokens ?? 0,
          requestCount: r.requestCount ?? 0,
        })),
        byUser: userReport.results.map((r) => ({
          userId: r.user ?? '',
          totalCost: r.totalCost,
          inputTokens: r.inputTokens ?? 0,
          outputTokens: r.outputTokens ?? 0,
          requestCount: r.requestCount ?? 0,
        })),
        credits: {
          balance: credits.balance,
          totalUsed: credits.totalUsed,
        },
      });
    } catch {
      return c.json({ daily: [], byUser: [], credits: null });
    }
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
