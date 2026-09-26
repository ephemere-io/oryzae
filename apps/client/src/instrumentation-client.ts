import * as Sentry from '@sentry/nextjs';
import { SENTRY_ENVIRONMENT, sentryPrivacyOptions } from './lib/sentry-privacy';

// ブラウザ側の Sentry 初期化。Next 16 は Turbopack でビルドするため、旧来の
// `sentry.client.config.ts` は読み込まれない（Sentry SDK 自身がそう警告する）。
// 以前はそこに書いていたので、DSN を入れてもブラウザのエラーは届かなかった。
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    tracesSampleRate: 1.0,
    ...sentryPrivacyOptions,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    // 既定値だが明示する。エラー時のリプレイに日記の文字・画像を映さない。
    integrations: [Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })],
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
