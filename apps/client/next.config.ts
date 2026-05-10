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
};

export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  tunnelRoute: '/monitoring',
});
