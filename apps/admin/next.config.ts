import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@oryzae/shared', '@oryzae/server'],
  turbopack: {},
  // 旧 Observability の URL。過去の Discord 日次レポートやブックマークが指しているので残す。
  async redirects() {
    return [
      { source: '/observability', destination: '/tools', permanent: true },
      { source: '/observability/errors', destination: '/errors', permanent: true },
      { source: '/observability/:path*', destination: '/tools/:path*', permanent: true },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  tunnelRoute: '/monitoring',
});
