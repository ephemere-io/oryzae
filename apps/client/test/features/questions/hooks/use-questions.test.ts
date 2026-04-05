import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useQuestions } from '@/features/questions/hooks/use-questions';
import type { ApiClient } from '@/lib/api';

function createMockApi(fetchImpl: ReturnType<typeof vi.fn>): ApiClient {
  return {
    baseUrl: '',
    headers: {},
    fetch: fetchImpl,
  };
}

function mockResponse(ok: boolean, body: unknown): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
    status: ok ? 200 : 400,
  } as Response;
}

describe('useQuestions', () => {
  let apiFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch = vi.fn();
  });

  it('fetches questions on mount', async () => {
    const questions = [
      {
        id: 'q1',
        currentText: 'How are you?',
        isArchived: false,
        isProposedByOryzae: false,
        isValidatedByUser: true,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      },
    ];
    apiFetch.mockResolvedValueOnce(mockResponse(true, questions));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useQuestions(api, false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.questions).toHaveLength(1);
    expect(result.current.questions[0].id).toBe('q1');
    expect(apiFetch).toHaveBeenCalledWith('/api/v1/questions/all');
  });

  it('does not fetch when authLoading is true', async () => {
    const api = createMockApi(apiFetch);

    renderHook(() => useQuestions(api, true));

    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('createQuestion calls API and refreshes list', async () => {
    const initialQuestions = [
      {
        id: 'q1',
        currentText: 'Question 1',
        isArchived: false,
        isProposedByOryzae: false,
        isValidatedByUser: true,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      },
    ];
    const updatedQuestions = [
      ...initialQuestions,
      {
        id: 'q2',
        currentText: 'Question 2',
        isArchived: false,
        isProposedByOryzae: false,
        isValidatedByUser: false,
        createdAt: '2024-01-02',
        updatedAt: '2024-01-02',
      },
    ];

    // Initial fetch
    apiFetch.mockResolvedValueOnce(mockResponse(true, initialQuestions));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useQuestions(api, false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.questions).toHaveLength(1);

    // createQuestion POST + refresh fetch
    apiFetch.mockResolvedValueOnce(mockResponse(true, {}));
    apiFetch.mockResolvedValueOnce(mockResponse(true, updatedQuestions));

    await act(async () => {
      await result.current.createQuestion('Question 2');
    });

    await waitFor(() => {
      expect(result.current.questions).toHaveLength(2);
    });

    expect(apiFetch).toHaveBeenCalledWith(
      '/api/v1/questions',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
