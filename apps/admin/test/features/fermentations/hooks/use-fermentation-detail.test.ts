import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FermentationDetailResponse } from '@/features/fermentations/hooks/use-fermentation-detail';
import { useFermentationDetail } from '@/features/fermentations/hooks/use-fermentation-detail';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(ok: boolean, body: unknown): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
    status: ok ? 200 : 500,
  } as Response; // @type-assertion-allowed: テスト用の最小限 Response スタブ
}

const mockData: FermentationDetailResponse = {
  id: 'f1',
  userId: 'u1',
  questionId: 'q1',
  entryId: 'e1',
  targetPeriod: '2026-04-11',
  status: 'completed',
  generationId: 'gen-1',
  errorMessage: null,
  createdAt: '2026-04-11T10:00:00Z',
  updatedAt: '2026-04-11T10:01:00Z',
  userEmail: 'test@example.com',
  questionText: 'What motivates you?',
  cost: { totalCost: 0.001234 },
  masked: false,
  worksheet: {
    id: 'w1',
    fermentationResultId: 'f1',
    worksheetMarkdown: '## Analysis',
    resultDiagramMarkdown: '```diagram```',
    createdAt: '2026-04-11T10:00:00Z',
    updatedAt: '2026-04-11T10:00:00Z',
  },
  snippets: [
    {
      id: 's1',
      fermentationResultId: 'f1',
      snippetType: 'core',
      originalText: 'Important text',
      sourceDate: '2026-04-10',
      selectionReason: 'Central theme',
      createdAt: '2026-04-11T10:00:00Z',
      updatedAt: '2026-04-11T10:00:00Z',
    },
  ],
  letter: {
    id: 'l1',
    fermentationResultId: 'f1',
    bodyText: 'Dear user...',
    createdAt: '2026-04-11T10:00:00Z',
    updatedAt: '2026-04-11T10:00:00Z',
  },
  keywords: [
    {
      id: 'k1',
      fermentationResultId: 'f1',
      keyword: 'motivation',
      description: 'What drives you',
      createdAt: '2026-04-11T10:00:00Z',
      updatedAt: '2026-04-11T10:00:00Z',
    },
  ],
};

describe('useFermentationDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('oryzae_admin_access_token', 'test-token');
  });

  it('fetches fermentation detail on mount', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(true, mockData));

    const { result } = renderHook(() => useFermentationDetail('f1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).not.toBeNull();
    expect(result.current.data?.status).toBe('completed');
    expect(result.current.data?.userEmail).toBe('test@example.com');
    expect(result.current.data?.worksheet).not.toBeNull();
    expect(result.current.data?.snippets).toHaveLength(1);
    expect(result.current.data?.letter).not.toBeNull();
    expect(result.current.data?.keywords).toHaveLength(1);
  });

  it('calls correct API path with id', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(true, mockData));

    renderHook(() => useFermentationDetail('f1'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const calledPath = mockFetch.mock.calls[0][0];
    expect(calledPath).toBe('/api/v1/admin/fermentations/f1');
  });

  it('sets error on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(false, {}));

    const { result } = renderHook(() => useFermentationDetail('f1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('発酵詳細の取得に失敗しました');
    expect(result.current.data).toBeNull();
  });

  it('refresh re-fetches data', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(true, mockData));

    const { result } = renderHook(() => useFermentationDetail('f1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const updatedData: FermentationDetailResponse = {
      ...mockData,
      status: 'failed',
      errorMessage: 'Something went wrong',
    };
    mockFetch.mockResolvedValueOnce(mockResponse(true, updatedData));

    result.current.refresh();

    await waitFor(() => {
      expect(result.current.data?.status).toBe('failed');
    });
  });

  it('retryFermentation calls POST and refreshes', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(true, mockData));

    const { result } = renderHook(() => useFermentationDetail('f1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // POST for retry + GET for refresh
    mockFetch.mockResolvedValueOnce(mockResponse(true, { id: 'f2' }));
    mockFetch.mockResolvedValueOnce(mockResponse(true, mockData));

    const success = await result.current.retryFermentation();

    expect(success).toBe(true);
    expect(mockFetch.mock.calls[1][0]).toBe('/api/v1/admin/fermentations/f1/retry');
    expect(mockFetch.mock.calls[1][1]).toEqual(expect.objectContaining({ method: 'POST' }));
  });

  it('retryFermentation returns false on failure', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(true, mockData));

    const { result } = renderHook(() => useFermentationDetail('f1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockFetch.mockResolvedValueOnce(mockResponse(false, { error: 'fail' }));

    const success = await result.current.retryFermentation();

    expect(success).toBe(false);
  });
});
