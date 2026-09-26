import * as Sentry from '@sentry/nextjs';
import { SENTRY_ENVIRONMENT, sentryPrivacyOptions } from './src/lib/sentry-privacy';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    tracesSampleRate: 1.0,
    ...sentryPrivacyOptions,
  });
}
