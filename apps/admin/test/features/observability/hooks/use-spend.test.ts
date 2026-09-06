import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSpend } from '@/features/observability/hooks/use-spend';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(ok: boolean, body: unknown): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
    status: ok ? 200 : 500,
  } as Response; // @type-assertion-allowed: テスト用の最小限 Response スタブ
}

const sampleSpend = {
  rangeDays: 30,
  actual: {
    status: 'ok',
    totalCostUsd: 1.23,
    daily: [{ date: '2026-08-08', costUsd: 1.23 }],
    truncated: false,
    message: null,
  },
  estimated: {
    status: 'ok',
    // 発酵 1.19 + OCR 0.30
    totalCostUsd: 1.49,
    truncated: false,
    fermentation: {
      pricing: { modelId: 'claude-sonnet-4-6', inputUsdPerMTok: 3, outputUsdPerMTok: 15 },
      totalCostUsd: 1.19,
      inputTokens: 300000,
      outputTokens: 40000,
      fermentationCount: 12,
      untrackedCount: 1,
      truncated: false,
      daily: [
        {
          date: '2026-08-08',
          estimatedCostUsd: 1.19,
          inputTokens: 300000,
          outputTokens: 40000,
          fermentationCount: 12,
        },
      ],
      byUser: [
        {
          userId: 'u1',
          email: 'user@test.com',
          estimatedCostUsd: 1.19,
          inputTokens: 300000,
          outputTokens: 40000,
          fermentationCount: 12,
        },
      ],
    },
    ocr: {
      status: 'ok',
      pricing: { modelId: 'claude-opus-5', inputUsdPerMTok: 5, outputUsdPerMTok: 25 },
      totalCostUsd: 0.3,
      inputTokens: 40000,
      outputTokens: 4000,
      requestCount: 4,
      untrackedCount: 0,
      truncated: false,
      daily: [
        {
          date: '2026-08-08',
          estimatedCostUsd: 0.3,
          inputTokens: 40000,
          outputTokens: 4000,
          requestCount: 4,
        },
      ],
      byModel: [
        {
          model: 'claude-opus-5',
          requestCount: 4,
          estimatedCostUsd: 0.3,
          inputTokens: 40000,
          outputTokens: 4000,
          unpriced: false,
        },
      ],
      byUser: [
        {
          userId: 'u1',
          email: 'user@test.com',
          estimatedCostUsd: 0.3,
          inputTokens: 40000,
          outputTokens: 4000,
          requestCount: 4,
        },
      ],
    },
  },
};

describe('useSpend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('oryzae_admin_access_token', 'test-token');
  });

  it('fetches actual and estimated spend on mount', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(true, sampleSpend));

    const { result } = renderHook(() => useSpend(30));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data?.actual.status).toBe('ok');
    expect(result.current.data?.actual.totalCostUsd).toBe(1.23);
    expect(result.current.data?.estimated.totalCostUsd).toBe(1.49);
    expect(result.current.data?.estimated.fermentation.byUser).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('passes the requested range to the API', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(true, sampleSpend));

    renderHook(() => useSpend(7));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    expect(String(mockFetch.mock.calls[0][0])).toContain('date_from=7');
  });

  it('keeps the not-configured status instead of coercing it to zero', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(true, {
        ...sampleSpend,
        actual: {
          status: 'not-configured',
          totalCostUsd: null,
          daily: [],
          truncated: false,
          message: null,
        },
      }),
    );

    const { result } = renderHook(() => useSpend(30));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data?.actual.status).toBe('not-configured');
    expect(result.current.data?.actual.totalCostUsd).toBeNull();
  });

  it('keeps the truncated flag so a partial actual cost is not shown as complete', async () => {
    // 打ち切りが落ちると SpendView の乖離率ガードが無言で効かなくなり、
    // 「推定が過大」に見えるだけの誤情報が復活する。
    mockFetch.mockResolvedValueOnce(
      mockResponse(true, {
        ...sampleSpend,
        actual: { ...sampleSpend.actual, truncated: true },
      }),
    );

    const { result } = renderHook(() => useSpend(30));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data?.actual.truncated).toBe(true);
  });

  it('sets error on a failed response', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(false, { error: 'Server error' }));

    const { result } = renderHook(() => useSpend(30));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('コストデータの取得に失敗しました');
  });

  it('clears loading when fetch rejects', async () => {
    // finally が無いと loading が true のまま固着する（回帰防止）
    mockFetch.mockRejectedValueOnce(new Error('network down'));

    const { result } = renderHook(() => useSpend(30));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('コストデータの取得に失敗しました');
  });

  // OCR は課金されているのに記録されておらず、推定に $0 しか乗っていなかった。
  // 分けて取れていることと、片方だけ落ちた状態を ok と言わないことを固定する。
  it('OCR の推定を発酵と分けて保持する', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(true, sampleSpend));

    const { result } = renderHook(() => useSpend(30));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data?.estimated.ocr.totalCostUsd).toBe(0.3);
    expect(result.current.data?.estimated.ocr.requestCount).toBe(4);
    // 単価はサーバー (claude-pricing.ts) が正。画面側で決め打たない。
    expect(result.current.data?.estimated.ocr.pricing.modelId).toBe('claude-opus-5');
    expect(result.current.data?.estimated.ocr.pricing.inputUsdPerMTok).toBe(5);
    expect(result.current.data?.estimated.fermentation.pricing.modelId).toBe('claude-sonnet-4-6');
  });

  it('OCR だけ取れていない状態を partial として保持する（ok にしない）', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(true, {
        ...sampleSpend,
        estimated: {
          ...sampleSpend.estimated,
          status: 'partial',
          totalCostUsd: 1.19,
          ocr: { ...sampleSpend.estimated.ocr, status: 'error', totalCostUsd: 0, requestCount: 0 },
        },
      }),
    );

    const { result } = renderHook(() => useSpend(30));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data?.estimated.status).toBe('partial');
    expect(result.current.data?.estimated.ocr.status).toBe('error');
  });

  it('OCR ブロックが欠けた応答は取り込まない（$0 として描画させない）', async () => {
    const { ocr: _ocr, ...withoutOcr } = sampleSpend.estimated;
    mockFetch.mockResolvedValueOnce(mockResponse(true, { ...sampleSpend, estimated: withoutOcr }));

    const { result } = renderHook(() => useSpend(30));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('コストデータの取得に失敗しました');
  });

  it('does nothing when no token is stored', async () => {
    localStorage.clear();

    const { result } = renderHook(() => useSpend(30));

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });
});
