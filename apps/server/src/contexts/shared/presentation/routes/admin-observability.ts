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
  purpose: string;
  configured: boolean;
  adminPath: string | null;
  externalUrl: string;
  externalLabel: string;
  metrics: { label: string; value: string }[];
}

async function getSentryMetrics(): Promise<{ label: string; value: string }[]> {
  const authToken = process.env.SENTRY_AUTH_TOKEN;
  const org = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT;
  if (!authToken || !org || !project) return [];

  try {
    const res = await fetch(
      `https://sentry.io/api/0/projects/${org}/${project}/issues/?query=is:unresolved&limit=25`,
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    if (!res.ok) return [{ label: '未解決エラー', value: '取得失敗' }];

    const body: unknown = await res.json();
    const issues = Array.isArray(body) ? body : [];

    return [{ label: '未解決エラー', value: `${issues.length} 件` }];
  } catch {
    return [{ label: '未解決エラー', value: '取得失敗' }];
  }
}

async function getGatewayMetrics(
  supabase: SupabaseClient,
): Promise<{ label: string; value: string }[]> {
  try {
    const { count } = await supabase
      .from('fermentation_results')
      .select('id', { count: 'exact', head: true })
      .not('generation_id', 'is', null);

    const tracked = count ?? 0;
    if (tracked === 0) return [{ label: 'コスト追跡', value: '0 件' }];

    const { data } = await supabase
      .from('fermentation_results')
      .select('generation_id')
      .not('generation_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);

    let sampleCost = '';
    if (data?.[0]?.generation_id) {
      try {
        const info = await gateway.getGenerationInfo({ id: data[0].generation_id });
        if (typeof info?.totalCost === 'number') {
          sampleCost = `（直近: $${info.totalCost.toFixed(4)}）`;
        }
      } catch {
        // ignore
      }
    }

    return [{ label: 'コスト追跡', value: `${tracked} 件${sampleCost}` }];
  } catch {
    return [{ label: 'コスト追跡', value: '取得失敗' }];
  }
}

export const adminObservability = new Hono<Env>().get('/summary', async (c) => {
  const supabase = c.get('adminSupabase');

  const [sentryMetrics, gatewayMetrics] = await Promise.all([
    getSentryMetrics(),
    getGatewayMetrics(supabase),
  ]);

  const tools: ToolSummary[] = [
    {
      id: 'posthog',
      name: 'PostHog',
      purpose:
        'ユーザーがプロダクトをどう使っているかを分析する。PV・セッション・滞在時間・ページ遷移を自動計測し、ユーザー識別で個人単位の行動も追跡できる。',
      configured: !!process.env.POSTHOG_PERSONAL_API_KEY,
      adminPath: '/analytics',
      externalUrl: 'https://us.posthog.com/project/378500',
      externalLabel: 'PostHog Dashboard',
      metrics: [],
    },
    {
      id: 'sentry',
      name: 'Sentry',
      purpose:
        'アプリで発生した例外をリアルタイムにキャプチャする。スタックトレース・影響ユーザー数・発生頻度でエラーの深刻度を判断し、アラートで通知する。',
      configured: !!process.env.SENTRY_AUTH_TOKEN,
      adminPath: null,
      externalUrl: 'https://oryzae.sentry.io',
      externalLabel: 'Sentry Issues',
      metrics: sentryMetrics,
    },
    {
      id: 'vercel-ai-gateway',
      name: 'Vercel AI Gateway',
      purpose:
        'LLM（Claude）の API 呼び出しコストを per-request で追跡する。トークン数・USD コスト・レイテンシをリクエスト単位で記録し、ユーザー別集計もできる。',
      configured: !!process.env.AI_GATEWAY_API_KEY,
      adminPath: '/costs',
      externalUrl: 'https://vercel.com',
      externalLabel: 'Vercel Dashboard',
      metrics: gatewayMetrics,
    },
    {
      id: 'upstash',
      name: 'Upstash Redis',
      purpose:
        'API のレート制限を実行する。発酵（5回/分）、認証（10回/分）、一般（60回/分）の3ティアで過負荷・不正アクセスを防ぐ。',
      configured: !!process.env.UPSTASH_REDIS_REST_URL,
      adminPath: null,
      externalUrl: 'https://console.upstash.com',
      externalLabel: 'Upstash Console',
      metrics: [],
    },
    {
      id: 'vercel',
      name: 'Vercel',
      purpose:
        'アプリのホスティング・デプロイを管理する。ビルドログ・サーバーログ・ドメイン設定・環境変数を確認できる。',
      configured: true,
      adminPath: null,
      externalUrl: 'https://vercel.com',
      externalLabel: 'Vercel Dashboard',
      metrics: [],
    },
  ];

  return c.json({ tools });
});
