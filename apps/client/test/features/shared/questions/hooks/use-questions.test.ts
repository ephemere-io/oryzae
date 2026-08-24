import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useQuestions } from '@/features/shared/questions/hooks/use-questions';
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

    const { result } = renderHook(() => useQuestions(api));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.questions).toHaveLength(1);
    expect(result.current.questions[0].id).toBe('q1');
    expect(apiFetch).toHaveBeenCalledWith('/api/v1/questions/all');
  });

  it('does not fetch when api is null (Issue #362: api ゲート)', async () => {
    renderHook(() => useQuestions(null));

    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('取得失敗時は error=true になる (Issue #357)', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(false, {}));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useQuestions(api));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBe(true);
    expect(result.current.questions).toHaveLength(0);
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

    const { result } = renderHook(() => useQuestions(api));

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
  it('配列でないレスポンスでも落ちず空のまま', async () => {
    // 素通しだと非配列が state に入り、タイムラインや SP の .filter / .map で落ちる。
    apiFetch.mockResolvedValue(mockResponse(true, { error: 'boom' }));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useQuestions(api));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.questions).toEqual([]);
  });

  it('id を持たない要素は落とし、欠けたフィールドは既定値に潰す', async () => {
    apiFetch.mockResolvedValue(
      mockResponse(true, [
        { id: 'q1', currentText: '問い', isArchived: true },
        { currentText: 'id 無し' },
        null,
        { id: 'q2' },
      ]),
    );
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useQuestions(api));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.questions.map((q) => q.id)).toEqual(['q1', 'q2']);
    expect(result.current.questions[0].isArchived).toBe(true);
    // 未設定は「まだ本文が無い問い」として null、真偽値は false に潰す
    expect(result.current.questions[1].currentText).toBeNull();
    expect(result.current.questions[1].isArchived).toBe(false);
    expect(result.current.questions[1].createdAt).toBe('');
  });

  it('通信が失敗したら error になり loading も戻る', async () => {
    apiFetch.mockRejectedValue(new Error('network down'));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useQuestions(api));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
    expect(result.current.questions).toEqual([]);
  });
});
