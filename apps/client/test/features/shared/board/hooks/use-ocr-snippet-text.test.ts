import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useOcrSnippetText } from '@/features/shared/board/hooks/use-ocr-snippet-text';
import type { ApiClient } from '@/lib/api';

function createMockApi(fetchImpl: ReturnType<typeof vi.fn>): ApiClient {
  return { baseUrl: '', headers: {}, fetch: fetchImpl };
}

function jsonResponse(ok: boolean, body: unknown): Response {
  // @type-assertion-allowed: テスト用の最小限 Response スタブ
  return { ok, status: ok ? 200 : 400, json: () => Promise.resolve(body) } as Response;
}

function imageFile(): File {
  return new File(['binary'], 'memo.png', { type: 'image/png' });
}

describe('useOcrSnippetText', () => {
  beforeEach(() => vi.clearAllMocks());

  it('読み取れた本文を ok で返し、multipart で POST する', async () => {
    const fetchImpl = vi.fn((_path: string, _init?: RequestInit) =>
      Promise.resolve(jsonResponse(true, { text: '読み取れた文字' })),
    );
    const { result } = renderHook(() => useOcrSnippetText(createMockApi(fetchImpl)));

    await expect(result.current(imageFile())).resolves.toEqual({
      status: 'ok',
      text: '読み取れた文字',
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [path, init] = fetchImpl.mock.calls[0];
    expect(path).toBe('/api/v1/board/snippets/ocr');
    expect(init?.method).toBe('POST');
    // JSON ではなく multipart で送る（Content-Type は api.fetch 側が FormData を見て外す）。
    const body = init?.body;
    expect(body).toBeInstanceOf(FormData);
    expect(body instanceof FormData ? body.get('file') : null).toBeInstanceOf(File);
  });

  it('50文字を超える読み取り結果もそのまま返す（切り詰めはユーザーの編集に委ねる）', async () => {
    const long = 'あ'.repeat(300);
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(true, { text: long })));
    const { result } = renderHook(() => useOcrSnippetText(createMockApi(fetchImpl)));

    await expect(result.current(imageFile())).resolves.toEqual({ status: 'ok', text: long });
  });

  it('文字が1つも読み取れなければ empty を返す（空白のみも empty 扱い）', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(true, { text: '   \n ' })));
    const { result } = renderHook(() => useOcrSnippetText(createMockApi(fetchImpl)));

    await expect(result.current(imageFile())).resolves.toEqual({ status: 'empty' });
  });

  it('サーバーが 4xx/5xx なら failed', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(false, { error: 'too large' })));
    const { result } = renderHook(() => useOcrSnippetText(createMockApi(fetchImpl)));

    await expect(result.current(imageFile())).resolves.toEqual({ status: 'failed' });
  });

  it('text を持たないレスポンスは failed', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(true, { unexpected: 1 })));
    const { result } = renderHook(() => useOcrSnippetText(createMockApi(fetchImpl)));

    await expect(result.current(imageFile())).resolves.toEqual({ status: 'failed' });
  });

  it('通信が投げても failed に落とす（未処理 rejection にしない）', async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new Error('offline')));
    const { result } = renderHook(() => useOcrSnippetText(createMockApi(fetchImpl)));

    await expect(result.current(imageFile())).resolves.toEqual({ status: 'failed' });
  });

  it('api が null なら通信せず failed', async () => {
    const { result } = renderHook(() => useOcrSnippetText(null));

    await expect(result.current(imageFile())).resolves.toEqual({ status: 'failed' });
  });
});
