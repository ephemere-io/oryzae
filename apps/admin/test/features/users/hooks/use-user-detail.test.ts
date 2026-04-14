import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserDetailResponse } from '@/features/users/hooks/use-user-detail';
import { useUserDetail } from '@/features/users/hooks/use-user-detail';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(ok: boolean, body: unknown): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
    status: ok ? 200 : 500,
  } as Response; // @type-assertion-allowed: テスト用の最小限 Response スタブ
}

const mockData: UserDetailResponse = {
  profile: {
    id: 'user-1',
    email: 'test@example.com',
    createdAt: '2026-01-01T00:00:00Z',
    lastSignInAt: '2026-04-10T12:00:00Z',
  },
  entries: [{ id: 'e1', characterCount: 150, createdAt: '2026-04-10T10:00:00Z' }],
  questions: [
    { id: 'q1', text: 'What motivates you?', isArchived: false, createdAt: '2026-03-01T00:00:00Z' },
  ],
  fermentations: [
    {
      id: 'f1',
      status: 'completed',
      errorMessage: null,
      hasGenerationId: true,
      createdAt: '2026-04-09T00:00:00Z',
    },
  ],
  entryDates: [{ date: '2026-04-10', count: 2 }],
};

describe('useUserDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('oryzae_admin_access_token', 'test-token');
  });

  it('fetches user detail on mount', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(true, mockData));

    const { result } = renderHook(() => useUserDetail('user-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).not.toBeNull();
    expect(result.current.data?.profile.email).toBe('test@example.com');
    expect(result.current.data?.entries).toHaveLength(1);
    expect(result.current.data?.questions).toHaveLength(1);
    expect(result.current.data?.fermentations).toHaveLength(1);
    expect(result.current.data?.entryDates).toHaveLength(1);
  });

  it('calls correct API path with userId', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(true, mockData));

    renderHook(() => useUserDetail('user-1'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const calledPath = mockFetch.mock.calls[0][0];
    expect(calledPath).toBe('/api/v1/admin/users/user-1');
  });

  it('sets error on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(false, {}));

    const { result } = renderHook(() => useUserDetail('user-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('ユーザー詳細の取得に失敗しました');
    expect(result.current.data).toBeNull();
  });

  it('refresh re-fetches data', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(true, mockData));

    const { result } = renderHook(() => useUserDetail('user-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const updatedData: UserDetailResponse = {
      ...mockData,
      profile: { ...mockData.profile, email: 'updated@example.com' },
    };
    mockFetch.mockResolvedValueOnce(mockResponse(true, updatedData));

    result.current.refresh();

    await waitFor(() => {
      expect(result.current.data?.profile.email).toBe('updated@example.com');
    });
  });
});
