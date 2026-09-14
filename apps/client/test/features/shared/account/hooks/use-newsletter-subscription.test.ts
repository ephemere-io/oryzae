import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNewsletterSubscription } from '@/features/shared/account/hooks/use-newsletter-subscription';
import { mockResponse } from '../../../../helpers/response';

const TOKEN_KEY = 'oryzae_access_token';

describe('useNewsletterSubscription', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(TOKEN_KEY, 'test-token');
    vi.restoreAllMocks();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it('現在値を /users/me から読む', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(mockResponse(true, { newsletterOptOut: true }));

    const { result } = renderHook(() => useNewsletterSubscription());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchSpy).toHaveBeenCalledWith('/api/v1/users/me', expect.anything());
    expect(result.current.optOut).toBe(true);
  });

  // 仮の既定値を出すと、実際は停止中なのに「受け取る」に見え、
  // 触った結果その値が保存されてしまう。読めなければ null のままにする。
  it('読めなければ null のまま（既定値を仮置きしない）', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse(false, {}));

    const { result } = renderHook(() => useNewsletterSubscription());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.optOut).toBeNull();
  });

  it('想定外の形でも null に倒す', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse(true, { newsletterOptOut: 'yes-please' }),
    );

    const { result } = renderHook(() => useNewsletterSubscription());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.optOut).toBeNull();
  });

  it('トークンが無ければ通信しない', async () => {
    localStorage.clear();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const { result } = renderHook(() => useNewsletterSubscription());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('切り替えは PATCH /auth/profile に newsletterOptOut を送る', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(mockResponse(true, { newsletterOptOut: false }));

    const { result } = renderHook(() => useNewsletterSubscription());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.setOptOut(true);
    });

    expect(fetchSpy).toHaveBeenLastCalledWith(
      '/api/v1/auth/profile',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ newsletterOptOut: true }),
      }),
    );
    expect(result.current.optOut).toBe(true);
  });

  // 「止めたつもりが届く」がいちばん困る。保存できなければ画面も動かさない。
  it('保存に失敗したら値を動かさず error を立てる', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(mockResponse(true, { newsletterOptOut: false }));

    const { result } = renderHook(() => useNewsletterSubscription());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.optOut).toBe(false);

    fetchSpy.mockResolvedValueOnce(mockResponse(false, {}));
    await act(async () => {
      await result.current.setOptOut(true);
    });

    expect(result.current.optOut).toBe(false);
    expect(result.current.error).not.toBeNull();
    expect(result.current.saving).toBe(false);
  });
});
