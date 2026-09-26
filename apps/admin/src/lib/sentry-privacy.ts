/**
 * Sentry に日記本文を載せないための共通設定（`docs/security-guide.md`）。
 *
 * Sentry の Node SDK は既定で**受けたリクエストの本文を 10KB まで**イベントに添付する
 * （`httpIntegration` の `maxIncomingRequestBodySize: 'medium'`）。本文を POST する
 * `/api/v1/entries` で例外が起きれば、日記がそのまま Sentry に送られる。
 * 送る前に落とす（`beforeSend`）と、そもそも拾わない（`maxIncomingRequestBodySize`）の両方で塞ぐ。
 */

interface ScrubbableEvent {
  request?: {
    data?: unknown;
    cookies?: unknown;
    headers?: Record<string, string>;
  };
}

const SENSITIVE_HEADERS = new Set(['cookie', 'authorization', 'x-supabase-auth']);

export function scrubSentryEvent<E extends ScrubbableEvent>(event: E): E {
  const request = event.request;
  if (!request) return event;
  delete request.data;
  delete request.cookies;
  if (request.headers) {
    for (const key of Object.keys(request.headers)) {
      if (SENSITIVE_HEADERS.has(key.toLowerCase())) delete request.headers[key];
    }
  }
  return event;
}

/** preview の失敗を本番のエラーと混ぜないため、Vercel の環境名で分ける。 */
export const SENTRY_ENVIRONMENT =
  process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? 'development';

export const sentryPrivacyOptions = {
  sendDefaultPii: false,
  beforeSend: scrubSentryEvent,
  beforeSendTransaction: scrubSentryEvent,
};
