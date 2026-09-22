import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHelpResolver } from '@/features/shared/help/hooks/use-help-resolver';
import { helpTextsFrom } from '@/features/shared/help/hooks/use-help-texts';
import type { HelpTopicId } from '@/features/shared/help/types';
import jaMessages from '@/i18n/messages/ja.json';
import type { ApiClient } from '@/lib/api';
import { mockResponse } from '../../../../helpers/response';

const TEXTS = helpTextsFrom((key) => {
  const [id, field] = key.split('.');
  const topics: Record<string, Record<string, string>> = jaMessages.help.topics;
  return topics[id ?? '']?.[field ?? ''] ?? key;
});

function createApiStub(): ApiClient & { fetch: ReturnType<typeof vi.fn> } {
  return { baseUrl: '', headers: {}, fetch: vi.fn() };
}

/** どの話題の語にも当たらない問い。手元では決まらず、Jev に回る。 */
const VAGUE = 'ぼんやりした不安をどうにかしたい';

function useSubject(
  api: ApiClient | null,
  query: string,
  label: string | null = null,
  labelFallback: HelpTopicId | null = null,
) {
  return useHelpResolver(api, {
    locale: 'ja',
    screen: '/',
    texts: TEXTS,
    query,
    label,
    labelFallback,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useHelpResolver — 検索欄', () => {
  it('手元で決めきれる問いは、サーバーに訊かない', async () => {
    const api = createApiStub();
    const { result } = renderHook(() => useSubject(api, '去年書いたものを読み返したい'));
    expect(result.current.matches[0]?.id).toBe('archive');
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(api.fetch).not.toHaveBeenCalled();
    expect(result.current.remote).toBe('idle');
  });

  it('手元で決まらない問いは、少し待ってから訊き、Jev の選んだ話題を先頭に置く', async () => {
    const api = createApiStub();
    api.fetch.mockResolvedValue(
      mockResponse(true, { configured: true, topicId: 'letter', confidence: 0.8 }),
    );
    const { result } = renderHook(() => useSubject(api, VAGUE));
    expect(result.current.matches.every((m) => m.source === 'local')).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(api.fetch).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(api.fetch).toHaveBeenCalledTimes(1);
    const [path, init] = api.fetch.mock.calls[0];
    expect(path).toBe('/api/v1/help/search');
    const body = JSON.parse(init.body);
    expect(body.query).toBe(VAGUE);
    expect(body.locale).toBe('ja');
    expect(body.topics).toHaveLength(TEXTS.length);
    expect(body.topics[0]).toEqual({
      id: 'concept',
      label: expect.stringContaining('Oryzae とは'),
    });

    expect(result.current.matches[0]).toEqual({
      id: 'letter',
      score: Number.POSITIVE_INFINITY,
      source: 'jev',
    });
    expect(result.current.matches.filter((m) => m.id === 'letter')).toHaveLength(1);
    expect(result.current.remote).toBe('answered');
  });

  it('確からしさが低い答えは採らない', async () => {
    const api = createApiStub();
    api.fetch.mockResolvedValue(
      mockResponse(true, { configured: true, topicId: 'letter', confidence: 0.3 }),
    );
    const { result } = renderHook(() => useSubject(api, VAGUE));
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.matches.some((m) => m.source === 'jev')).toBe(false);
  });

  it('未設定と分かれば、以後は訊かない', async () => {
    const api = createApiStub();
    api.fetch.mockResolvedValue(
      mockResponse(true, { configured: false, topicId: null, confidence: 0 }),
    );
    const { result, rerender } = renderHook(({ q }) => useSubject(api, q), {
      initialProps: { q: VAGUE },
    });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(api.fetch).toHaveBeenCalledTimes(1);
    expect(result.current.remote).toBe('off');

    rerender({ q: 'ふわふわした気持ち' });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(api.fetch).toHaveBeenCalledTimes(1);
  });

  it('同じ問いは憶えていて、二度目は訊かない', async () => {
    const api = createApiStub();
    api.fetch.mockResolvedValue(
      mockResponse(true, { configured: true, topicId: 'letter', confidence: 0.9 }),
    );
    const { rerender } = renderHook(({ q }) => useSubject(api, q), {
      initialProps: { q: VAGUE },
    });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    rerender({ q: '' });
    rerender({ q: VAGUE });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(api.fetch).toHaveBeenCalledTimes(1);
  });

  it('api が無ければ手元だけ', () => {
    const { result } = renderHook(() => useSubject(null, '瓶'));
    expect(result.current.remote).toBe('off');
    expect(result.current.matches[0]?.id).toBe('jar');
  });
});

describe('useHelpResolver — 触れている部品の名前', () => {
  it('名前で決まれば、それ', () => {
    const api = createApiStub();
    const { result } = renderHook(() => useSubject(api, '', '瓶に漬ける'));
    expect(result.current.labelTopic).toBe('pickle');
    expect(api.fetch).not.toHaveBeenCalled();
  });

  it('名前で決まらなければ、先祖の名乗り', async () => {
    const api = createApiStub();
    const { result } = renderHook(() => useSubject(api, '', 'OK', 'board'));
    expect(result.current.labelTopic).toBe('board');
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(api.fetch).not.toHaveBeenCalled();
  });

  it('名乗りも無ければ、止まってから Jev に訊く', async () => {
    const api = createApiStub();
    api.fetch.mockResolvedValue(
      mockResponse(true, { configured: true, topicId: 'account', confidence: 0.7 }),
    );
    const { result } = renderHook(() => useSubject(api, '', 'Sign out'));
    expect(result.current.labelTopic).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(api.fetch).toHaveBeenCalledTimes(1);
    expect(result.current.labelTopic).toBe('account');
  });

  it('通り過ぎただけの部品では訊かない', async () => {
    const api = createApiStub();
    const initial: { label: string | null } = { label: 'Sign out' };
    const { rerender } = renderHook(({ label }) => useSubject(api, '', label), {
      initialProps: initial,
    });
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    rerender({ label: null });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(api.fetch).not.toHaveBeenCalled();
  });
});
