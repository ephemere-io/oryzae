import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTriggerScheduledFermentation } from '@/features/fermentations/hooks/use-trigger-scheduled-fermentation';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(ok: boolean, body: unknown): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
    status: ok ? 200 : 500,
  } as Response; // @type-assertion-allowed: テスト用の最小限 Response スタブ
}

describe('useTriggerScheduledFermentation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('oryzae_admin_access_token', 'test-token');
  });

  it('sends POST with dateKey and stores the result on success', async () => {
    const body = {
      dateKey: '2026-04-15',
      totalUsers: 2,
      totalFermentations: 3,
      succeeded: 3,
      failed: 0,
      errors: [],
    };
    mockFetch.mockResolvedValueOnce(mockResponse(true, body));

    const { result } = renderHook(() => useTriggerScheduledFermentation());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.trigger('2026-04-15');
    });

    expect(ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/admin/fermentations/trigger-scheduled',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ dateKey: '2026-04-15' }),
      }),
    );
    await waitFor(() => {
      expect(result.current.result).toEqual(body);
    });
    expect(result.current.error).toBeNull();
  });

  it('sends empty body when dateKey is omitted', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(true, {
        dateKey: '2026-04-15',
        totalUsers: 0,
        totalFermentations: 0,
        succeeded: 0,
        failed: 0,
        errors: [],
      }),
    );

    const { result } = renderHook(() => useTriggerScheduledFermentation());

    await act(async () => {
      await result.current.trigger();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/admin/fermentations/trigger-scheduled',
      expect.objectContaining({
        body: JSON.stringify({}),
      }),
    );
  });

  it('sets error on failure and returns false', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(false, {}));

    const { result } = renderHook(() => useTriggerScheduledFermentation());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.trigger('2026-04-15');
    });

    expect(ok).toBe(false);
    expect(result.current.error).toBe('発酵プロセスの発火に失敗しました');
    expect(result.current.result).toBeNull();
  });
});
