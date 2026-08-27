import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePhotoImport } from '@/features/shared/entries/hooks/use-photo-import';
import type { ApiClient } from '@/lib/api';
import { I18nWrapper } from '../../../../helpers/i18n-wrapper';

// リサイズはブラウザ API（createImageBitmap / canvas）依存なので、ここでは
// 「呼ばれて、その戻りが送信される」ことだけを見る。中身は test/lib/resize-image.test.ts。
const { resizeMock } = vi.hoisted(() => ({ resizeMock: vi.fn() }));
vi.mock('@/lib/resize-image', () => ({
  resizeImageForUpload: resizeMock,
  ImageDecodeError: class ImageDecodeError extends Error {},
}));

function createMockApi(fetchImpl: ReturnType<typeof vi.fn>): ApiClient {
  return { baseUrl: '', headers: {}, fetch: fetchImpl };
}

function mockResponse(ok: boolean, body: unknown, status = ok ? 200 : 400): Response {
  // @type-assertion-allowed: テストで必要な最小限の Response スタブ
  return { ok, status, json: () => Promise.resolve(body) } as Response;
}

const RESIZED = new File(['jpeg-bytes'], 'note.jpg', { type: 'image/jpeg' });
const PICKED = new File(['raw'], 'IMG_0001.HEIC', { type: 'image/heic' });

describe('usePhotoImport', () => {
  let apiFetch: ReturnType<typeof vi.fn>;
  let onAttach: ReturnType<typeof vi.fn>;
  let onInsertText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch = vi.fn();
    onAttach = vi.fn();
    onInsertText = vi.fn();
    resizeMock.mockResolvedValue(RESIZED);
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview');
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  function setup() {
    return renderHook(
      () => usePhotoImport({ api: createMockApi(apiFetch), onAttach, onInsertText }),
      { wrapper: I18nWrapper },
    );
  }

  it('初期状態は閉じている', () => {
    const { result } = setup();
    expect(result.current.state.open).toBe(false);
    expect(result.current.state.transcript).toBeNull();
  });

  it('ファイルを選ぶとリサイズしてプレビューを開く', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.selectFile(PICKED);
    });

    expect(resizeMock).toHaveBeenCalledWith(PICKED);
    expect(result.current.state.open).toBe(true);
    expect(result.current.state.previewUrl).toBe('blob:preview');
    expect(result.current.state.status).toBe('idle');
    expect(result.current.state.error).toBe('');
  });

  it('デコードに失敗したらエラーを出し、通信はしない', async () => {
    resizeMock.mockRejectedValue(new Error('unsupported'));
    const { result } = setup();

    await act(async () => {
      await result.current.selectFile(PICKED);
    });

    expect(result.current.state.error).not.toBe('');
    expect(result.current.state.previewUrl).toBeNull();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('文字起こしはリサイズ済みファイルとロケールを送り、結果を state に置く', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(true, { text: '今日は雨だった。' }));
    const { result } = setup();

    await act(async () => {
      await result.current.selectFile(PICKED);
    });
    await act(async () => {
      await result.current.transcribe();
    });

    const [path, init] = apiFetch.mock.calls[0];
    expect(path).toBe('/api/v1/entries/photos/transcribe');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.body.get('file')).toBe(RESIZED);
    expect(init.body.get('language')).toBe('ja');

    expect(result.current.state.transcript).toBe('今日は雨だった。');
    expect(result.current.state.status).toBe('idle');
    // 結果は state に置くだけ。確認前に本文へ入れない。
    expect(onInsertText).not.toHaveBeenCalled();
  });

  it('文字起こしの結果が空でも transcript は空文字として区別する（未実行の null と別）', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(true, { text: '' }));
    const { result } = setup();

    await act(async () => {
      await result.current.selectFile(PICKED);
    });
    await act(async () => {
      await result.current.transcribe();
    });

    expect(result.current.state.transcript).toBe('');
  });

  it('429 はレート制限の文言を出す', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(false, {}, 429));
    const { result } = setup();

    await act(async () => {
      await result.current.selectFile(PICKED);
    });
    await act(async () => {
      await result.current.transcribe();
    });

    expect(result.current.state.error).toBe(
      '読み取りの回数制限に達しました。少し待ってからお試しください。',
    );
    expect(result.current.state.transcript).toBeNull();
  });

  it('文字起こしが落ちても status は idle に戻す（再操作できる）', async () => {
    apiFetch.mockRejectedValueOnce(new Error('network'));
    const { result } = setup();

    await act(async () => {
      await result.current.selectFile(PICKED);
    });
    await act(async () => {
      await result.current.transcribe();
    });

    expect(result.current.state.status).toBe('idle');
    expect(result.current.state.error).not.toBe('');
  });

  it('insertTranscript は本文へ渡してから閉じる', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(true, { text: '起こした文' }));
    const { result } = setup();

    await act(async () => {
      await result.current.selectFile(PICKED);
    });
    await act(async () => {
      await result.current.transcribe();
    });
    act(() => {
      result.current.insertTranscript();
    });

    expect(onInsertText).toHaveBeenCalledWith('起こした文');
    expect(result.current.state.open).toBe(false);
  });

  it('discardTranscript は結果だけ捨ててプレビューに戻る', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(true, { text: '起こした文' }));
    const { result } = setup();

    await act(async () => {
      await result.current.selectFile(PICKED);
    });
    await act(async () => {
      await result.current.transcribe();
    });
    act(() => {
      result.current.discardTranscript();
    });

    expect(result.current.state.transcript).toBeNull();
    expect(result.current.state.open).toBe(true);
    expect(result.current.state.previewUrl).toBe('blob:preview');
  });

  // 保存するのは storagePath。signedUrl は表示専用で 1 時間で失効する（00023 / #504）。
  it('写真として貼ると path と署名 URL を親へ渡して閉じる', async () => {
    apiFetch.mockResolvedValueOnce(
      mockResponse(
        true,
        { storagePath: 'u/1-a.jpg', signedUrl: 'https://cdn.example/a.jpg?token=abc' },
        201,
      ),
    );
    const { result } = setup();

    await act(async () => {
      await result.current.selectFile(PICKED);
    });
    await act(async () => {
      await result.current.attach();
    });

    expect(apiFetch.mock.calls[0][0]).toBe('/api/v1/entries/photos');
    expect(onAttach).toHaveBeenCalledWith({
      storagePath: 'u/1-a.jpg',
      signedUrl: 'https://cdn.example/a.jpg?token=abc',
    });
    await waitFor(() => {
      expect(result.current.state.open).toBe(false);
    });
  });

  it('storagePath だけで signedUrl が欠けるレスポンスでは親へ渡さずエラーにする', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(true, { storagePath: 'u/1-a.jpg' }, 201));
    const { result } = setup();

    await act(async () => {
      await result.current.selectFile(PICKED);
    });
    await act(async () => {
      await result.current.attach();
    });

    expect(onAttach).not.toHaveBeenCalled();
    expect(result.current.state.error).not.toBe('');
    expect(result.current.state.open).toBe(true);
  });

  it('閉じるとプレビューの object URL を解放する', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.selectFile(PICKED);
    });
    act(() => {
      result.current.close();
    });

    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
    expect(result.current.state.open).toBe(false);
  });

  it('api が無いときは通信しない', async () => {
    const { result } = renderHook(() => usePhotoImport({ api: null, onAttach, onInsertText }), {
      wrapper: I18nWrapper,
    });

    await act(async () => {
      await result.current.selectFile(PICKED);
    });
    await act(async () => {
      await result.current.transcribe();
      await result.current.attach();
    });

    expect(apiFetch).not.toHaveBeenCalled();
  });
});
