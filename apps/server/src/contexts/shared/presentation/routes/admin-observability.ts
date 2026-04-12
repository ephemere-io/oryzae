import type { SupabaseClient } from '@supabase/supabase-js';
import { Hono } from 'hono';

type Env = {
  Variables: {
    adminUserId: string;
    adminSupabase: SupabaseClient;
  };
};

interface ToolStatus {
  id: string;
  name: string;
  concern: string;
  configured: boolean;
  adminPath: string | null;
  externalUrl: string;
  description: string;
}

export const adminObservability = new Hono<Env>().get('/status', async (c) => {
  const tools: ToolStatus[] = [
    {
      id: 'posthog',
      name: 'PostHog',
      concern: 'ユーザー行動',
      configured: !!process.env.NEXT_PUBLIC_POSTHOG_KEY,
      adminPath: '/analytics',
      externalUrl: 'https://us.posthog.com/project/378500',
      description: 'PV・セッション・滞在時間・ページ別アクセス・ユーザー識別',
    },
    {
      id: 'sentry',
      name: 'Sentry',
      concern: 'エラー監視',
      configured: !!process.env.SENTRY_DSN,
      adminPath: null,
      externalUrl: 'https://oryzae.sentry.io',
      description: '例外キャプチャ・スタックトレース・影響ユーザー数・アラート',
    },
    {
      id: 'vercel-ai-gateway',
      name: 'Vercel AI Gateway',
      concern: 'LLM コスト',
      configured: !!process.env.AI_GATEWAY_API_KEY,
      adminPath: '/costs',
      externalUrl: 'https://vercel.com',
      description: 'per-request トークン数・USD コスト・ユーザー別集計',
    },
    {
      id: 'upstash',
      name: 'Upstash Redis',
      concern: 'API 保護',
      configured: !!process.env.UPSTASH_REDIS_REST_URL,
      adminPath: null,
      externalUrl: 'https://console.upstash.com',
      description: 'レート制限（発酵 5/min, 認証 10/min, 一般 60/min）',
    },
    {
      id: 'vercel',
      name: 'Vercel',
      concern: 'デプロイ',
      configured: true,
      adminPath: null,
      externalUrl: 'https://vercel.com',
      description: 'ビルド状態・サーバーログ・ドメイン管理',
    },
  ];

  return c.json({ tools });
});
