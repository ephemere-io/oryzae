import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetchSentryIssues = vi.fn();
vi.mock('@/contexts/shared/infrastructure/sentry-api.js', () => ({
  fetchSentryIssues: mockFetchSentryIssues,
  sentryIssuesConsoleUrl: () => 'https://oryzae.sentry.io/issues/',
  SENTRY_ENVIRONMENT: 'production',
}));

const { adminErrors } = await import('@/contexts/shared/presentation/routes/admin-errors.js');

describe('GET /api/v1/admin/errors', () => {
  beforeEach(() => {
    mockFetchSentryIssues.mockReset();
    vi.stubEnv('SENTRY_DSN', 'https://key@o1.ingest.sentry.io/1');
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('reports whether this deployment has the sending DSNs, without their values', async () => {
    mockFetchSentryIssues.mockResolvedValueOnce({
      kind: 'ok',
      issues: [],
      daily: [],
      truncated: false,
    });

    const res = await adminErrors.request('/');
    const body = await res.json();

    expect(body.status).toBe('ok');
    expect(body.sending).toEqual({ server: true, browser: false });
    expect(JSON.stringify(body)).not.toContain('ingest.sentry.io');
  });

  it('passes through the missing read-side variables', async () => {
    mockFetchSentryIssues.mockResolvedValueOnce({
      kind: 'not-configured',
      missing: ['SENTRY_AUTH_TOKEN'],
    });

    const body = await (await adminErrors.request('/')).json();

    expect(body).toMatchObject({
      status: 'not-configured',
      missing: ['SENTRY_AUTH_TOKEN'],
      issues: [],
    });
  });

  it('passes through the error message instead of an empty list that reads as "no errors"', async () => {
    mockFetchSentryIssues.mockResolvedValueOnce({ kind: 'error', message: 'HTTP 403' });

    const body = await (await adminErrors.request('/')).json();

    expect(body).toMatchObject({ status: 'error', message: 'HTTP 403' });
  });
});
