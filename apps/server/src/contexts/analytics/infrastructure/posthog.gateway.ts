import type { AnalyticsGateway, TrendResult } from '../domain/gateways/analytics.gateway.js';

interface PostHogTrendResponse {
  result: TrendResult[];
}

interface PostHogQueryResponse {
  results: unknown[][];
}

function isPostHogTrendResponse(data: unknown): data is PostHogTrendResponse {
  if (typeof data !== 'object' || data === null) return false;
  return 'result' in data && Array.isArray((data as PostHogTrendResponse).result);
}

function isPostHogQueryResponse(data: unknown): data is PostHogQueryResponse {
  if (typeof data !== 'object' || data === null) return false;
  return 'results' in data && Array.isArray((data as PostHogQueryResponse).results);
}

export class PostHogGateway implements AnalyticsGateway {
  private readonly projectId: string;
  private readonly host: string;

  constructor(projectId = '378500', host = 'https://us.i.posthog.com') {
    this.projectId = projectId;
    this.host = host;
  }

  async queryTrend(params: {
    dateFrom: string;
    events: { id: string; math: string }[];
    properties?: { key: string; value: string; operator: string }[];
    breakdown?: string;
    breakdownType?: string;
    interval?: string;
  }): Promise<TrendResult[]> {
    const body: Record<string, unknown> = {
      events: params.events,
      date_from: params.dateFrom,
    };
    if (params.properties) body.properties = params.properties;
    if (params.breakdown) body.breakdown = params.breakdown;
    if (params.breakdownType) body.breakdown_type = params.breakdownType;
    if (params.interval) body.interval = params.interval;

    const res = await this.post('/insights/trend/', body, isPostHogTrendResponse);
    return res?.result ?? [];
  }

  async queryHogQL(query: string): Promise<unknown[][]> {
    const res = await this.post(
      '/query/',
      { query: { kind: 'HogQLQuery', query } },
      isPostHogQueryResponse,
    );
    return res?.results ?? [];
  }

  private async post<T>(
    path: string,
    body: unknown,
    guard: (data: unknown) => data is T,
  ): Promise<T | null> {
    const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
    if (!apiKey) return null;

    const res = await fetch(`${this.host}/api/projects/${this.projectId}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (!guard(data)) return null;
    return data;
  }
}
