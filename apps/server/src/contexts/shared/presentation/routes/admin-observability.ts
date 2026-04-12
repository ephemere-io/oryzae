import type { SupabaseClient } from '@supabase/supabase-js';
import { gateway } from 'ai';
import { Hono } from 'hono';

type Env = {
  Variables: {
    adminUserId: string;
    adminSupabase: SupabaseClient;
  };
};

interface ToolSummary {
  id: string;
  name: string;
  tagline: string;
  href: string | null;
  externalUrl: string;
  metric: { label: string; value: string } | null;
}

async function getSentryMetric(): Promise<{ label: string; value: string } | null> {
  const authToken = process.env.SENTRY_AUTH_TOKEN;
  const org = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT;
  if (!authToken || !org || !project) return null;

  try {
    const res = await fetch(
      `https://sentry.io/api/0/projects/${org}/${project}/issues/?query=is:unresolved&limit=25`,
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    if (!res.ok) return null;
    const body: unknown = await res.json();
    const issues = Array.isArray(body) ? body : [];
    return { label: '未解決エラー', value: `${issues.length} 件` };
  } catch {
    return null;
  }
}

async function getGatewayMetric(
  supabase: SupabaseClient,
): Promise<{ label: string; value: string } | null> {
  try {
    const { data } = await supabase
      .from('fermentation_results')
      .select('generation_id')
      .not('generation_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!data?.[0]?.generation_id) return { label: '直近コスト', value: 'データなし' };

    const info = await gateway.getGenerationInfo({ id: data[0].generation_id });
    if (typeof info?.totalCost === 'number') {
      return { label: '直近コスト', value: `$${info.totalCost.toFixed(4)}` };
    }
    return { label: '直近コスト', value: 'データなし' };
  } catch {
    return null;
  }
}

export const adminObservability = new Hono<Env>().get('/summary', async (c) => {
  const supabase = c.get('adminSupabase');

  const [sentryMetric, gatewayMetric] = await Promise.all([
    getSentryMetric(),
    getGatewayMetric(supabase),
  ]);

  // PostHog metrics are fetched client-side from /analytics/overview
  const tools: ToolSummary[] = [
    {
      id: 'posthog',
      name: 'PostHog',
      tagline: 'ユーザー行動分析',
      href: '/analytics',
      externalUrl: 'https://us.posthog.com/project/378500',
      metric: null,
    },
    {
      id: 'sentry',
      name: 'Sentry',
      tagline: 'エラー監視',
      href: null,
      externalUrl: 'https://oryzae.sentry.io',
      metric: sentryMetric,
    },
    {
      id: 'vercel-ai-gateway',
      name: 'Vercel AI Gateway',
      tagline: 'LLM コスト追跡',
      href: '/costs',
      externalUrl: 'https://vercel.com',
      metric: gatewayMetric,
    },
    {
      id: 'upstash',
      name: 'Upstash Redis',
      tagline: 'API レート制限',
      href: null,
      externalUrl: 'https://console.upstash.com',
      metric: null,
    },
    {
      id: 'vercel',
      name: 'Vercel',
      tagline: 'デプロイ・ホスティング',
      href: null,
      externalUrl: 'https://vercel.com',
      metric: null,
    },
  ];

  return c.json({ tools });
});
