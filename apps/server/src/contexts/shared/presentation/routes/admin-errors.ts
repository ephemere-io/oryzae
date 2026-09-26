import { Hono } from 'hono';
import {
  fetchSentryIssues,
  SENTRY_ENVIRONMENT,
  sentryIssuesConsoleUrl,
} from '../../infrastructure/sentry-api.js';

type Env = {
  Variables: {
    adminUserId: string;
  };
};

/**
 * admin の Errors 画面（Sentry）。
 *
 * `sending` は **この admin のデプロイ**に送信側の DSN が入っているかどうか。
 * client（oryzae-client）は別の Vercel プロジェクトなので、ここからは見えない。
 * 同じ名前の変数を両方に入れる運用なので、admin に無ければ client にも無い可能性が高い
 * ——という程度の手がかりとして出す（画面にもそう書く）。
 */
export const adminErrors = new Hono<Env>().get('/', async (c) => {
  const result = await fetchSentryIssues();
  const sending = {
    server: Boolean(process.env.SENTRY_DSN),
    browser: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  };
  const consoleUrl = sentryIssuesConsoleUrl();

  if (result.kind === 'not-configured') {
    return c.json({
      status: 'not-configured' as const,
      missing: result.missing,
      message: null,
      environment: SENTRY_ENVIRONMENT,
      sending,
      consoleUrl,
      issues: [],
      daily: [],
      truncated: false,
    });
  }
  if (result.kind === 'error') {
    console.error('[admin-errors] sentry fetch failed', { message: result.message });
    return c.json({
      status: 'error' as const,
      missing: [],
      message: result.message,
      environment: SENTRY_ENVIRONMENT,
      sending,
      consoleUrl,
      issues: [],
      daily: [],
      truncated: false,
    });
  }
  return c.json({
    status: 'ok' as const,
    missing: [],
    message: null,
    environment: SENTRY_ENVIRONMENT,
    sending,
    consoleUrl,
    issues: result.issues,
    daily: result.daily,
    truncated: result.truncated,
  });
});
