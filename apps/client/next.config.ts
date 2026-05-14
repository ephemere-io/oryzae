import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  transpilePackages: ['@oryzae/shared', '@oryzae/server'],
  turbopack: {},
  // Static MD-backed pages read their bodies from `src/content/**/*.md` at
  // request time. Next.js' file-trace can't detect dynamic `process.cwd()`
  // reads, so include the directories explicitly so the files ship with the
  // deployment.
  outputFileTracingIncludes: {
    '/privacy': ['./src/content/legal/**/*.md'],
    '/support': ['./src/content/support/**/*.md'],
  },
  // PostHog reverse proxy: 広告ブロッカーが posthog.com 系ドメインを既定で遮断する
  // ため (#225)、自ドメインの `/ingest/*` 経由でリクエストを中継する。
  // 公式ガイド: https://posthog.com/docs/advanced/proxy/nextjs
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
      {
        source: '/ingest/decide',
        destination: 'https://us.i.posthog.com/decide',
      },
    ];
  },
  // PostHog の rewrite 先 (`/ingest/...`) で末尾スラッシュリダイレクトが起きると
  // CORS/プリフライトが壊れるため無効化する。
  skipTrailingSlashRedirect: true,
};

export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  tunnelRoute: '/monitoring',
});
