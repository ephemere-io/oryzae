import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNewsletterSend } from '@/features/newsletters/hooks/use-newsletter-send';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

interface MockResponseInit {
  ok: boolean;
  status?: number;
  body?: unknown;
}

function mockResponse({ ok, status, body }: MockResponseInit): Response {
  return {
    ok,
    status: status ?? (ok ? 200 : 400),
    json: () => Promise.resolve(body ?? {}),
    // @type-assertion-allowed: テスト用の最小限 Response スタブ
  } as Response;
}

const newsletter = {
  id: 'nl-1',
  subject: '今月の更新',
  bodyMarkdown: '本文',
  status: 'sent',
  createdBy: 'admin-1',
  recipientCount: 3,
  sentCount: 3,
  failedCount: 0,
  lastError: null,
  sentAt: '2026-09-12T00:00:00.000Z',
  createdAt: '2026-09-11T00:00:00.000Z',
  updatedAt: '2026-09-12T00:00:00.000Z',
};

const preview = {
  id: 'nl-1',
  subject: '今月の更新',
  html: '<html><body>本文</body></html>',
  text: '今月の更新\n\n本文',
  recipientCount: 3,
  sendable: true,
};

describe('useNewsletterSend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('oryzae_admin_access_token', 'test-token');
  });

  it('プレビューを取得して HTML と宛先数を保持する', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ ok: true, body: { data: preview } }));

    const { result } = renderHook(() => useNewsletterSend());
    await act(async () => {
      await result.current.loadPreview('nl-1');
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/admin/newsletters/nl-1/preview',
      expect.anything(),
    );
    expect(result.current.preview?.recipientCount).toBe(3);
    expect(result.current.preview?.html).toContain('本文');
    expect(result.current.error).toBeNull();
  });

  it('送信は confirm: true を本文に載せる（API 側の確認契約）', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        ok: true,
        body: {
          data: { newsletter, sent: true, delivered: 3, failed: 0, failureReasons: [] },
        },
      }),
    );

    const { result } = renderHook(() => useNewsletterSend());
    await act(async () => {
      await result.current.send('nl-1');
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/admin/newsletters/nl-1/send',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ confirm: true }) }),
    );
    expect(result.current.result?.delivered).toBe(3);
  });

  it('送信されなかった場合も結果として受け取る（reason 付き）', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        ok: true,
        body: {
          data: {
            newsletter: { ...newsletter, status: 'draft', sentAt: null, sentCount: 0 },
            sent: false,
            reason: 'no-api-key',
            delivered: 0,
            failed: 0,
            failureReasons: [],
          },
        },
      }),
    );

    const { result } = renderHook(() => useNewsletterSend());
    await act(async () => {
      await result.current.send('nl-1');
    });

    expect(result.current.result?.sent).toBe(false);
    expect(result.current.result?.reason).toBe('no-api-key');
    expect(result.current.error).toBeNull();
  });

  it('4xx はサーバーの文言をそのまま出す', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ ok: false, status: 400, body: { error: 'この配信はすでに送信済みです' } }),
    );

    const { result } = renderHook(() => useNewsletterSend());
    await act(async () => {
      await result.current.send('nl-1');
    });

    expect(result.current.error).toBe('この配信はすでに送信済みです');
    expect(result.current.result).toBeNull();
  });

  it('200 なのに形が壊れている場合、「失敗した」と言い切らない（送信済みの可能性があるため）', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ ok: true, body: { data: { bogus: true } } }));

    const { result } = renderHook(() => useNewsletterSend());
    await act(async () => {
      await result.current.send('nl-1');
    });

    expect(result.current.error).toContain('状態を確認');
  });

  it('reset でプレビューと結果を捨てる（開き直しに前回の状態を持ち越さない）', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ ok: true, body: { data: preview } }));

    const { result } = renderHook(() => useNewsletterSend());
    await act(async () => {
      await result.current.loadPreview('nl-1');
    });
    expect(result.current.preview).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.preview).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
