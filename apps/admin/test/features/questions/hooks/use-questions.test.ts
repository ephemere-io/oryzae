import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useQuestions } from '@/features/questions/hooks/use-questions';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(ok: boolean, body: unknown): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
    status: ok ? 200 : 500,
  } as Response; // @type-assertion-allowed: テスト用の最小限 Response スタブ
}

const sampleItem = {
  id: 'q1',
  user_id: 'u1',
  user_email: 'a@example.com',
  user_nickname: 'alice',
  text: 'なぜ学ぶのか',
  is_archived: false,
  is_validated_by_user: true,
  is_proposed_by_oryzae: false,
  created_at: '2026-04-11T10:00:00Z',
  updated_at: '2026-04-12T10:00:00Z',
  readiness: {
    score: 0.5,
    charScore: 0.5,
    timeScore: 1,
    threshold: 1000,
    charsCurrent: 500,
    hoursElapsed: null,
    hoursRequired: null,
    eligible: false,
    language: 'ja' as const,
  },
};

describe('useQuestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('oryzae_admin_access_token', 'test-token');
  });

  it('fetches questions on mount', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(true, {
        data: [sampleItem],
        pagination: { page: 1, limit: 50, total: 1 },
      }),
    );

    const { result } = renderHook(() => useQuestions());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0].text).toBe('なぜ学ぶのか');
    expect(result.current.data[0].readiness.score).toBe(0.5);
    expect(result.current.pagination.total).toBe(1);
  });

  it('passes q, userId, archived filters to API', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(true, { data: [], pagination: { page: 1, limit: 50, total: 0 } }),
    );

    renderHook(() => useQuestions({ q: '学び', userId: 'u123', archived: 'true' }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('user_id=u123');
    expect(calledUrl).toContain('archived=true');
    // q は URLSearchParams で URI エンコードされる
    expect(calledUrl).toMatch(/q=[^&]+/);
  });

  it('omits empty filters from URL', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(true, { data: [], pagination: { page: 1, limit: 50, total: 0 } }),
    );

    renderHook(() => useQuestions({ page: 2 }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('page=2');
    expect(calledUrl).not.toContain('user_id=');
    expect(calledUrl).not.toContain('archived=');
    expect(calledUrl).not.toContain('q=');
  });

  it('sets error on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(false, {}));

    const { result } = renderHook(() => useQuestions());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('問いデータの取得に失敗しました');
  });
});
