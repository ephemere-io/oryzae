import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCreateQuestion } from '@/features/shared/questions/hooks/use-create-question';
import { ACTIVITY_EVENT, readActivityKind } from '@/lib/activity';
import type { ApiClient } from '@/lib/api';

/**
 * Issue #490: PC エディタの漬け込みフローが直叩きしていた「問いを作って id を得る」を
 * 共有 hook にした分の担保。useQuestions.createQuestion は id を返さないため別物。
 */
function createMockApi(fetchImpl: ReturnType<typeof vi.fn>): ApiClient {
  return { baseUrl: '', headers: {}, fetch: fetchImpl };
}

function jsonResponse(body: unknown, ok = true): Response {
  // @type-assertion-allowed: テスト用の最小限 Response スタブ
  return { ok, status: ok ? 200 : 400, json: () => Promise.resolve(body) } as Response;
}

/** window に出た合図の種類を集める（ヘルプの三歩が聞くもの）。 */
function collectActivity(): { kinds: string[]; stop: () => void } {
  const kinds: string[] = [];
  const listen = (e: Event) => {
    const kind = readActivityKind(e);
    if (kind) kinds.push(kind);
  };
  window.addEventListener(ACTIVITY_EVENT, listen);
  return { kinds, stop: () => window.removeEventListener(ACTIVITY_EVENT, listen) };
}

describe('useCreateQuestion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('作成した問いの id を返し、合図 question を出す', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ id: 'q-new' })));
    const { result } = renderHook(() => useCreateQuestion(createMockApi(fetchImpl)));
    const activity = collectActivity();

    await expect(result.current('なぜ書くのか')).resolves.toBe('q-new');
    expect(fetchImpl).toHaveBeenCalledWith('/api/v1/questions', {
      method: 'POST',
      body: JSON.stringify({ string: 'なぜ書くのか' }),
    });
    activity.stop();
    expect(activity.kinds).toEqual(['question']);
  });

  it('空文字・空白のみなら通信せず null', async () => {
    const fetchImpl = vi.fn();
    const { result } = renderHook(() => useCreateQuestion(createMockApi(fetchImpl)));

    await expect(result.current('   ')).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('api が null なら通信せず null', async () => {
    const { result } = renderHook(() => useCreateQuestion(null));
    await expect(result.current('x')).resolves.toBeNull();
  });

  it('失敗・id 欠落は null（呼び出し側は紐づけを中止する）', async () => {
    const failing = vi.fn(() => Promise.resolve(jsonResponse(null, false)));
    const { result: r1 } = renderHook(() => useCreateQuestion(createMockApi(failing)));
    const activity = collectActivity();
    await expect(r1.current('x')).resolves.toBeNull();
    activity.stop();
    // 失敗したら合図は出ない
    expect(activity.kinds).toEqual([]);

    const noId = vi.fn(() => Promise.resolve(jsonResponse({})));
    const { result: r2 } = renderHook(() => useCreateQuestion(createMockApi(noId)));
    await expect(r2.current('x')).resolves.toBeNull();
  });
});
