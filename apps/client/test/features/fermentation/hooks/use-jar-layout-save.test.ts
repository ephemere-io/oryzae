import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type JarLayout,
  useJarLayoutSave,
} from '@/features/fermentation/hooks/use-jar-layout-save';
import type { ApiClient } from '@/lib/api';

function createMockApi(fetchImpl: ReturnType<typeof vi.fn>): ApiClient {
  return { baseUrl: '', headers: {}, fetch: fetchImpl };
}

const sampleLayout: JarLayout = {
  questions: [{ id: 'q-1', jarX: 10, jarY: 20 }],
  keywords: [],
  snippets: [],
  letters: [],
};

describe('useJarLayoutSave', () => {
  let apiFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    apiFetch = vi.fn().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('500ms 経過後に PUT /api/v1/jar/layout で保存する', async () => {
    const api = createMockApi(apiFetch);
    const { result } = renderHook(() => useJarLayoutSave(api));

    act(() => {
      result.current.saveLayout(sampleLayout);
    });
    expect(apiFetch).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(apiFetch).toHaveBeenCalledWith('/api/v1/jar/layout', {
      method: 'PUT',
      body: JSON.stringify(sampleLayout),
    });
  });

  it('連続呼び出しは最後の payload で 1 回だけ保存する', async () => {
    const api = createMockApi(apiFetch);
    const { result } = renderHook(() => useJarLayoutSave(api));

    const layout1 = sampleLayout;
    const layout2: JarLayout = {
      ...sampleLayout,
      questions: [{ id: 'q-1', jarX: 80, jarY: 90 }],
    };

    act(() => {
      result.current.saveLayout(layout1);
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    act(() => {
      result.current.saveLayout(layout2);
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(apiFetch).toHaveBeenCalledWith('/api/v1/jar/layout', {
      method: 'PUT',
      body: JSON.stringify(layout2),
    });
  });

  it('api が null のときは何もしない', () => {
    const { result } = renderHook(() => useJarLayoutSave(null));

    act(() => {
      result.current.saveLayout(sampleLayout);
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(apiFetch).not.toHaveBeenCalled();
  });
});
