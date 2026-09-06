import { MAX_OCR_IMAGE_BYTES } from '@oryzae/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardOcrValidationError } from '@/contexts/board/application/errors/board.errors';
import { ExtractTextFromImageUsecase } from '@/contexts/board/application/usecases/extract-text-from-image.usecase';
import type { OcrGateway } from '@/contexts/board/domain/gateways/ocr.gateway';

let ocr: OcrGateway;
let usecase: ExtractTextFromImageUsecase;

function imageOf(bytes: number): ArrayBuffer {
  return new ArrayBuffer(bytes);
}

beforeEach(() => {
  ocr = {
    extractText: vi.fn().mockResolvedValue({
      text: '読み取れた文字',
      usage: { inputTokens: 100, outputTokens: 10 },
    }),
  };
  usecase = new ExtractTextFromImageUsecase(ocr);
});

describe('ExtractTextFromImageUsecase', () => {
  it('画像から読み取った本文を返す', async () => {
    const result = await usecase.execute({ image: imageOf(1024), mediaType: 'image/png' });

    expect(result.text).toBe('読み取れた文字');
    expect(ocr.extractText).toHaveBeenCalledWith({
      image: expect.any(ArrayBuffer),
      mediaType: 'image/png',
    });
  });

  it('50文字を超える読み取り結果でも切り詰めずに返す（削るのはユーザーの判断）', async () => {
    const long = 'あ'.repeat(300);
    ocr.extractText = vi
      .fn()
      .mockResolvedValue({ text: long, usage: { inputTokens: 1, outputTokens: 1 } });

    const result = await usecase.execute({ image: imageOf(1024), mediaType: 'image/jpeg' });

    expect(result.text).toBe(long);
  });

  it('1文字も読み取れなければ空文字を返す（エラーにはしない）', async () => {
    ocr.extractText = vi
      .fn()
      .mockResolvedValue({ text: '', usage: { inputTokens: 1, outputTokens: 1 } });

    const result = await usecase.execute({ image: imageOf(1024), mediaType: 'image/webp' });

    expect(result.text).toBe('');
  });

  it('対応外の MIME タイプで BoardOcrValidationError を投げる', async () => {
    await expect(
      usecase.execute({ image: imageOf(1024), mediaType: 'application/pdf' }),
    ).rejects.toThrow(BoardOcrValidationError);
    expect(ocr.extractText).not.toHaveBeenCalled();
  });

  it('空の画像で BoardOcrValidationError を投げる', async () => {
    await expect(usecase.execute({ image: imageOf(0), mediaType: 'image/png' })).rejects.toThrow(
      BoardOcrValidationError,
    );
    expect(ocr.extractText).not.toHaveBeenCalled();
  });

  it('上限を超えるサイズで BoardOcrValidationError を投げる（OCR は呼ばない）', async () => {
    await expect(
      usecase.execute({ image: imageOf(MAX_OCR_IMAGE_BYTES + 1), mediaType: 'image/png' }),
    ).rejects.toThrow(BoardOcrValidationError);
    expect(ocr.extractText).not.toHaveBeenCalled();
  });

  it('上限ちょうどのサイズは通す', async () => {
    const result = await usecase.execute({
      image: imageOf(MAX_OCR_IMAGE_BYTES),
      mediaType: 'image/png',
    });

    expect(result.text).toBe('読み取れた文字');
  });
});
