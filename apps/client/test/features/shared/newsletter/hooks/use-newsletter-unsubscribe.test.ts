import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNewsletterUnsubscribe } from '@/features/shared/newsletter/hooks/use-newsletter-unsubscribe';
import { mockResponse } from '../../../../helpers/response';

describe('useNewsletterUnsubscribe', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('開いた時点で配信停止まで済ませる（クリックするだけで解除できる）', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse(true, {}));

    const { result } = renderHook(() => useNewsletterUnsubscribe('tok-1'));

    await waitFor(() => expect(result.current.state.status).toBe('unsubscribed'));
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/newsletter/unsubscribe',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ token: 'tok-1' }) }),
    );
  });

  // メールクライアントやスキャナはリンクを先読みする。GET で状態が変わると
  // 本人が押していないのに停止されるので、必ず POST で送る。
  it('GET では送らない（リンク先読みで勝手に停止させない）', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse(true, {}));

    const { result } = renderHook(() => useNewsletterUnsubscribe('tok-1'));
    await waitFor(() => expect(result.current.state.status).toBe('unsubscribed'));

    for (const [, init] of fetchSpy.mock.calls) {
      expect(init?.method).toBe('POST');
    }
  });

  it('トークンが無ければ通信せずエラーにする', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const { result } = renderHook(() => useNewsletterUnsubscribe(null));

    expect(result.current.state).toEqual({
      status: 'error',
      message: 'リンクが正しくありません。',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('サーバーのエラー文言をそのまま出す', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse(false, { error: 'このリンクは無効です。' }),
    );

    const { result } = renderHook(() => useNewsletterUnsubscribe('forged'));

    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(result.current.state).toEqual({ status: 'error', message: 'このリンクは無効です。' });
  });

  it('本文が読めなくても案内を出す（黙って成功に見せない）', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse(false, null));

    const { result } = renderHook(() => useNewsletterUnsubscribe('tok-1'));

    await waitFor(() => expect(result.current.state.status).toBe('error'));
  });

  it('「やっぱり受け取る」で同じトークンを使って再開する', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse(true, {}));

    const { result } = renderHook(() => useNewsletterUnsubscribe('tok-1'));
    await waitFor(() => expect(result.current.state.status).toBe('unsubscribed'));

    await act(async () => {
      await result.current.resubscribe();
    });

    expect(result.current.state.status).toBe('resubscribed');
    expect(fetchSpy).toHaveBeenLastCalledWith(
      '/api/v1/newsletter/resubscribe',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ token: 'tok-1' }) }),
    );
  });
});
