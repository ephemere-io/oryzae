import { ENTRY_PHOTO_MAX_EDGE_PX } from '@oryzae/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageDecodeError, resizeImageForUpload } from '@/lib/resize-image';

/**
 * jsdom には createImageBitmap も canvas の 2d コンテキストも無いので、
 * どちらもスタブして「縮小の計算」と「JPEG への正規化」だけを検証する。
 */
interface BitmapStub {
  width: number;
  height: number;
  close: ReturnType<typeof vi.fn>;
}

let drawImage: ReturnType<typeof vi.fn>;
let toBlob: ReturnType<typeof vi.fn>;
let canvas: { width: number; height: number; getContext: ReturnType<typeof vi.fn> };

function stubBitmap(width: number, height: number): BitmapStub {
  return { width, height, close: vi.fn() };
}

function installCanvas() {
  drawImage = vi.fn();
  toBlob = vi.fn((cb: (b: Blob | null) => void) => cb(new Blob(['x'], { type: 'image/jpeg' })));
  canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({ drawImage })),
  };
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'canvas') {
      // @type-assertion-allowed: テスト用に canvas の必要部分だけを満たすスタブを返す
      return Object.assign(canvas, { toBlob }) as unknown as HTMLElement;
    }
    return document.createElementNS('http://www.w3.org/1999/xhtml', tag);
  });
}

describe('resizeImageForUpload', () => {
  beforeEach(() => {
    installCanvas();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, 'createImageBitmap');
  });

  function mockDecode(bitmap: BitmapStub | Error) {
    Object.defineProperty(globalThis, 'createImageBitmap', {
      configurable: true,
      writable: true,
      value: vi.fn(() =>
        bitmap instanceof Error ? Promise.reject(bitmap) : Promise.resolve(bitmap),
      ),
    });
  }

  it('長辺を上限まで縮め、アスペクト比を保つ', async () => {
    mockDecode(stubBitmap(4000, 3000));

    await resizeImageForUpload(new File(['x'], 'IMG_0001.HEIC', { type: 'image/heic' }));

    expect(canvas.width).toBe(ENTRY_PHOTO_MAX_EDGE_PX);
    // 3000 / 4000 * 1568 = 1176
    expect(canvas.height).toBe(Math.round((3000 / 4000) * ENTRY_PHOTO_MAX_EDGE_PX));
  });

  it('縦長の写真では高さが上限になる', async () => {
    mockDecode(stubBitmap(1000, 4000));

    await resizeImageForUpload(new File(['x'], 'note.png', { type: 'image/png' }));

    expect(canvas.height).toBe(ENTRY_PHOTO_MAX_EDGE_PX);
    expect(canvas.width).toBe(Math.round((1000 / 4000) * ENTRY_PHOTO_MAX_EDGE_PX));
  });

  it('上限以下の画像は拡大しない（形式を揃えるためだけに canvas を通す）', async () => {
    mockDecode(stubBitmap(800, 600));

    await resizeImageForUpload(new File(['x'], 'small.jpg', { type: 'image/jpeg' }));

    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
  });

  it('EXIF の向きをピクセルに焼き込む（imageOrientation: from-image）', async () => {
    mockDecode(stubBitmap(1000, 1000));

    await resizeImageForUpload(new File(['x'], 'p.jpg', { type: 'image/jpeg' }));

    expect(globalThis.createImageBitmap).toHaveBeenCalledWith(expect.anything(), {
      imageOrientation: 'from-image',
    });
  });

  it('JPEG に正規化し、拡張子も .jpg に揃える', async () => {
    mockDecode(stubBitmap(100, 100));

    const out = await resizeImageForUpload(
      new File(['x'], 'IMG_0001.HEIC', { type: 'image/heic' }),
    );

    expect(out.type).toBe('image/jpeg');
    expect(out.name).toBe('IMG_0001.jpg');
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.85);
  });

  it('デコードできない画像は ImageDecodeError を投げる', async () => {
    mockDecode(new Error('unsupported'));

    await expect(
      resizeImageForUpload(new File(['x'], 'broken.jpg', { type: 'image/jpeg' })),
    ).rejects.toBeInstanceOf(ImageDecodeError);
  });

  it('toBlob が null を返したら ImageDecodeError を投げる', async () => {
    mockDecode(stubBitmap(100, 100));
    toBlob.mockImplementation((cb: (b: Blob | null) => void) => cb(null));

    await expect(
      resizeImageForUpload(new File(['x'], 'p.jpg', { type: 'image/jpeg' })),
    ).rejects.toBeInstanceOf(ImageDecodeError);
  });

  it('デコードした bitmap を必ず解放する', async () => {
    const bitmap = stubBitmap(100, 100);
    mockDecode(bitmap);

    await resizeImageForUpload(new File(['x'], 'p.jpg', { type: 'image/jpeg' }));

    expect(bitmap.close).toHaveBeenCalled();
  });
});
