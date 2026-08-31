import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlaceableEntries } from '@/features/shared/board/hooks/use-placeable-entries';
import type { ApiClient } from '@/lib/api';
import { mockResponse } from '../../../../helpers/response';

function createMockApi(fetchImpl: ReturnType<typeof vi.fn>): ApiClient {
  return { baseUrl: '', headers: {}, fetch: fetchImpl };
}

const ENTRY = {
  id: 'e-1',
  title: '朝の記録',
  preview: '朝の記録の本文',
  createdAt: '2026-04-11T10:00:00Z',
  placed: false,
};

describe('usePlaceableEntries', () => {
  let apiFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch = vi.fn();
  });

  it('enabled が false のあいだは取りに行かない', () => {
    const api = createMockApi(apiFetch);
    renderHook(() => usePlaceableEntries(api, '2026-04-11', 'daily', false));

    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('enabled になったら候補を取る', async () => {
    apiFetch.mockResolvedValue(mockResponse(true, { entries: [ENTRY] }));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => usePlaceableEntries(api, '2026-04-11', 'daily', true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries).toEqual([ENTRY]);
    expect(result.current.error).toBe(false);
  });

  it('dateKey / viewType / tzOffset をクエリに載せる', async () => {
    apiFetch.mockResolvedValue(mockResponse(true, { entries: [] }));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => usePlaceableEntries(api, '2026-08-10', 'weekly', true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const path = apiFetch.mock.calls[0][0];
    expect(path).toContain('dateKey=2026-08-10');
    expect(path).toContain('viewType=weekly');
    // 暦日の境界はローカル時刻で決まるので、オフセットを必ず渡す（#ボードの日付境界）
    expect(path).toContain('tzOffset=');
  });

  it('失敗したら error を立てて一覧を空にする（黙って空にしない）', async () => {
    apiFetch.mockResolvedValue(mockResponse(false, { error: 'boom' }));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => usePlaceableEntries(api, '2026-04-11', 'daily', true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
    expect(result.current.entries).toEqual([]);
  });

  it('entries が配列でない応答でも落ちない', async () => {
    apiFetch.mockResolvedValue(mockResponse(true, { entries: null }));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => usePlaceableEntries(api, '2026-04-11', 'daily', true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries).toEqual([]);
  });

  it('api が無いあいだは取りに行かない', () => {
    renderHook(() => usePlaceableEntries(null, '2026-04-11', 'daily', true));

    expect(apiFetch).not.toHaveBeenCalled();
  });
});
