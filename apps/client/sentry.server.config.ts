import * as Sentry from '@sentry/nextjs';
import { SENTRY_ENVIRONMENT, sentryPrivacyOptions } from './src/lib/sentry-privacy';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    tracesSampleRate: 1.0,
    ...sentryPrivacyOptions,
    // 受けたリクエストの本文を拾わない（既定は 10KB まで添付する）。日記の本文が POST されるため。
    integrations: [Sentry.httpIntegration({ maxIncomingRequestBodySize: 'none' })],
  });
}
