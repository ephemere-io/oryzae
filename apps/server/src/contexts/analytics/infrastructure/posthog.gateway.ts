import type { AnalyticsGateway } from '../domain/gateways/analytics.gateway.js';

interface PostHogQueryResponse {
  results: unknown[][];
}

function isPostHogQueryResponse(data: unknown): data is PostHogQueryResponse {
  if (typeof data !== 'object' || data === null) return false;
  if (!('results' in data)) return false;
  return Array.isArray(data.results);
}

/**
 * PostHog 照会が「未設定」または「HTTP 失敗」したことを表す。
 * 以前は失敗を握りつぶしてゼロを返していたため、設定ミス・権限不足が
 * 画面上「データ 0 件」と区別できなかった。これを呼び出し側で検知できるようにする。
 * status 0 = 未設定（APIキー無し）、それ以外 = PostHog から返った HTTP ステータス。
 */
export class PostHogUnavailableError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'PostHogUnavailableError';
  }
}

export class PostHogGateway implements AnalyticsGateway {
  private readonly projectId: string;
  private readonly host: string;

  constructor(projectId = '378500', host = 'https://us.i.posthog.com') {
    this.projectId = projectId;
    this.host = host;
  }

  async queryHogQL(query: string): Promise<unknown[][]> {
    const res = await this.post(
      '/query/',
      { query: { kind: 'HogQLQuery', query } },
      isPostHogQueryResponse,
    );
    return res.results;
  }

  private async post<T>(
    path: string,
    body: unknown,
    guard: (data: unknown) => data is T,
  ): Promise<T> {
    const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
    if (!apiKey) {
      throw new PostHogUnavailableError(0, 'POSTHOG_PERSONAL_API_KEY is not set');
    }

    const res = await fetch(`${this.host}/api/projects/${this.projectId}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      // 失敗は黙殺せず Vercel ログに残す（HTTP コード＋本文先頭。キーは出さない）。
      const detail = await res.text().catch(() => '');
      console.error(`[posthog] POST ${path} failed: HTTP ${res.status} ${detail.slice(0, 200)}`);
      throw new PostHogUnavailableError(res.status, `PostHog API responded ${res.status}`);
    }

    const data: unknown = await res.json();
    if (!guard(data)) {
      console.error(`[posthog] POST ${path} unexpected response shape`);
      throw new PostHogUnavailableError(res.status, 'Unexpected PostHog response shape');
    }
    return data;
  }
}
