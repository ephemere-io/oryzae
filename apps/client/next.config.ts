import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { DOCS_SITE_URL } from './src/lib/docs-site';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  transpilePackages: ['@oryzae/shared', '@oryzae/server', '@oryzae/verify'],
  turbopack: {},
  // `/privacy` と `/support` は公開サイト（別リポジトリ・別ドメイン）へ移した。
  // これらの URL は App Store の審査情報やメール文面など**アプリの外から参照されている**
  // ため、消すのではなく 301 で恒久転送する。検索評価も移設先へ引き継ぐ。
  async redirects() {
    return [
      { source: '/privacy', destination: `${DOCS_SITE_URL}/privacy`, permanent: true },
      { source: '/support', destination: `${DOCS_SITE_URL}/support`, permanent: true },
    ];
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
