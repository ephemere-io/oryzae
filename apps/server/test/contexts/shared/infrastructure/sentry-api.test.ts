import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchSentryIssues, sumDailyEvents } from '@/contexts/shared/infrastructure/sentry-api.js';

const mockFetch = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

const NOW = new Date('2026-09-26T10:00:00.000Z');
const DAY_SEC = 24 * 60 * 60;
const TODAY_SEC = Date.UTC(2026, 8, 26) / 1000;

function issue(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    shortId: 'ORYZAE-1',
    title: 'Error: Row column "date_key" expected string but got undefined',
    culprit: 'GET /api/[...path]',
    level: 'error',
    count: '29',
    userCount: 2,
    firstSeen: '2026-09-23T00:54:27Z',
    lastSeen: '2026-09-23T16:22:31Z',
    permalink: 'https://oryzae.sentry.io/issues/1/',
    isUnhandled: true,
    stats: { '14d': [[TODAY_SEC - DAY_SEC, 4] as const, [TODAY_SEC, 1] as const] },
    ...overrides,
  };
}

describe('fetchSentryIssues', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('SENTRY_AUTH_TOKEN', 'sntryu_test');
    vi.stubEnv('SENTRY_ORG', 'oryzae');
    vi.stubEnv('SENTRY_PROJECT', 'oryzae');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('names the missing variables instead of returning an empty list', async () => {
    vi.stubEnv('SENTRY_AUTH_TOKEN', '');

    const result = await fetchSentryIssues(NOW);

    // 空配列に潰すと「エラー無し」と読める。9 月まで実際にそうなっていた。
    expect(result).toEqual({ kind: 'not-configured', missing: ['SENTRY_AUTH_TOKEN'] });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('asks only for unresolved production issues with 14-day stats', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));

    await fetchSentryIssues(NOW);

    const url = new URL(String(mockFetch.mock.calls[0]?.[0]));
    expect(url.pathname).toBe('/api/0/projects/oryzae/oryzae/issues/');
    expect(url.searchParams.get('query')).toBe('is:unresolved');
    expect(url.searchParams.get('environment')).toBe('production');
    expect(url.searchParams.get('statsPeriod')).toBe('14d');
  });

  it('maps issues, parses the string count and flags issues first seen in the last 24h', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        issue(),
        issue({ id: '2', shortId: 'ORYZAE-2', firstSeen: '2026-09-26T01:00:00Z' }),
      ]),
    );

    const result = await fetchSentryIssues(NOW);

    if (result.kind !== 'ok') throw new Error(`expected ok, got ${result.kind}`);
    expect(result.issues[0]).toMatchObject({
      count: 29,
      userCount: 2,
      isNew: false,
      isUnhandled: true,
    });
    expect(result.issues[1]?.isNew).toBe(true);
    expect(result.truncated).toBe(false);
  });

  it('explains a permission error rather than showing no issues', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ detail: 'forbidden' }, 403));

    const result = await fetchSentryIssues(NOW);

    expect(result.kind).toBe('error');
    if (result.kind === 'error') expect(result.message).toContain('event:read');
  });

  it('reports an unexpected response shape as an error', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ not: 'an array' }));

    const result = await fetchSentryIssues(NOW);

    expect(result.kind).toBe('error');
  });

  it('reports a network failure as an error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('timeout'));

    const result = await fetchSentryIssues(NOW);

    expect(result).toEqual({ kind: 'error', message: 'Sentry に接続できませんでした (timeout)' });
  });
});

describe('sumDailyEvents', () => {
  it('sums the buckets of all issues into a continuous 14-day series', () => {
    const daily = sumDailyEvents(
      [
        {
          stats: {
            '14d': [
              [TODAY_SEC - DAY_SEC, 4],
              [TODAY_SEC, 1],
            ],
          },
        },
        { stats: { '14d': [[TODAY_SEC, 2]] } },
        {},
      ],
      NOW,
    );

    expect(daily).toHaveLength(14);
    expect(daily[0]?.date).toBe('2026-09-13');
    expect(daily.at(-2)).toEqual({ date: '2026-09-25', events: 4 });
    expect(daily.at(-1)).toEqual({ date: '2026-09-26', events: 3 });
  });
});
