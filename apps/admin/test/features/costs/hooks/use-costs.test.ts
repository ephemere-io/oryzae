import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCosts } from '@/features/costs/hooks/use-costs';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(ok: boolean, body: unknown): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
    status: ok ? 200 : 500,
  } as Response; // @type-assertion-allowed: テスト用の最小限 Response スタブ
}

const sample = {
  period: { from: '2026-09-01', to: '2026-09-26', label: '9/1 9:00 〜 9/27 9:00 (JST)' },
  actual: {
    status: 'ok',
    totalUsd: 31.6,
    byWorkspace: [
      { name: 'oryzae-prod-fermentation', costUsd: 0.41, outsideOryzae: false },
      { name: 'Default Workspace', costUsd: 31.17, outsideOryzae: true },
    ],
    daily: [{ date: '2026-09-25', costUsd: 0.26 }],
    projection: { projectedUsd: 37.75, daysElapsed: 25, daysInMonth: 30 },
    truncated: false,
  },
  usage: {
    status: 'ok',
    features: [
      {
        feature: 'fermentation',
        model: 'claude-sonnet-4-6',
        rate: { inputUsdPerMTok: 3, outputUsdPerMTok: 15 },
        count: 2,
        userCount: 1,
        inputTokens: 6210,
        outputTokens: 7796,
        estimatedUsd: 0.1356,
      },
    ],
    users: [
      {
        userId: 'u1',
        label: 'kunimo (k@example.com)',
        counts: { fermentation: 2, ocr_board: 0, ocr_entry: 0 },
        inputTokens: 6210,
        outputTokens: 7796,
        estimatedUsd: 0.1356,
      },
    ],
    truncated: false,
  },
  consoleUrl: 'https://platform.claude.com/cost',
};

describe('useCosts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('oryzae_admin_access_token', 'test-token');
  });

  it('期間を省略すると今月（サーバーの既定）を引く', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(true, sample));

    const { result } = renderHook(() => useCosts(null));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(String(mockFetch.mock.calls[0]?.[0])).toMatch(/\/api\/v1\/admin\/costs$/);
    expect(result.current.data).toEqual(sample);
    expect(result.current.error).toBeNull();
  });

  it('期間を UTC 日で渡す', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(true, sample));

    const { result } = renderHook(() => useCosts({ from: '2026-08-01', to: '2026-08-31' }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(String(mockFetch.mock.calls[0]?.[0])).toContain('from=2026-08-01&to=2026-08-31');
  });

  // 実額が取れない日に 0 と出さないため、status ごとに形が違う。
  it('実額が未設定でも、記録の側は受け取れる', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(true, { ...sample, actual: { status: 'not-configured' } }),
    );

    const { result } = renderHook(() => useCosts(null));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data?.actual.status).toBe('not-configured');
    expect(result.current.data?.usage.status).toBe('ok');
  });

  it('形が違えばエラーにする', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(true, { unexpected: true }));

    const { result } = renderHook(() => useCosts(null));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('コストの取得に失敗しました');
  });

  it('サーバーが失敗したらエラーにする', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(false, { error: 'boom' }));

    const { result } = renderHook(() => useCosts(null));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('コストの取得に失敗しました');
  });
});
