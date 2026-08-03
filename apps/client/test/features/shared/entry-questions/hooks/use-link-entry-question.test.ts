import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLinkEntryQuestion } from '@/features/shared/entry-questions/hooks/use-entry-questions';
import type { ApiClient } from '@/lib/api';

/**
 * Issue #490: `useEntryQuestions` は entryId を hook 生成時に束縛するため、保存して初めて
 * id が決まる新規作成では使えず、`app/(protected)/entries/new/page.tsx` が POST を
 * 直叩きしていた。呼び出し時に entryId を渡せる形に切り出した分の担保。
 */
function createMockApi(fetchImpl: ReturnType<typeof vi.fn>): ApiClient {
  return { baseUrl: '', headers: {}, fetch: fetchImpl };
}

describe('useLinkEntryQuestion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('保存後に決まった entryId で紐づけを POST する', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve({ ok: true }));
    const { result } = renderHook(() => useLinkEntryQuestion(createMockApi(fetchImpl)));

    await result.current('e1', 'q1');

    expect(fetchImpl).toHaveBeenCalledWith('/api/v1/entries/e1/questions/q1', { method: 'POST' });
  });

  it('api が null なら通信しない', async () => {
    const { result } = renderHook(() => useLinkEntryQuestion(null));
    await expect(result.current('e1', 'q1')).resolves.toBeUndefined();
  });
});
