import { MAX_OCR_IMAGE_BYTES } from '@oryzae/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardOcrValidationError } from '@/contexts/board/application/errors/board.errors';
import { ExtractTextFromImageUsecase } from '@/contexts/board/application/usecases/extract-text-from-image.usecase';
import type { OcrGateway } from '@/contexts/board/domain/gateways/ocr.gateway';
import type { OcrUsageRecorder } from '@/contexts/board/domain/gateways/ocr-usage.recorder';

let ocr: OcrGateway;
let usageRecorder: OcrUsageRecorder;
let usecase: ExtractTextFromImageUsecase;

function imageOf(bytes: number): ArrayBuffer {
  return new ArrayBuffer(bytes);
}

function run(overrides: { mediaType?: string; image?: ArrayBuffer } = {}) {
  return usecase.execute({
    userId: 'user-1',
    image: overrides.image ?? imageOf(1024),
    mediaType: overrides.mediaType ?? 'image/png',
  });
}

beforeEach(() => {
  ocr = {
    extractText: vi.fn().mockResolvedValue({
      text: '読み取れた文字',
      model: 'claude-opus-5',
      usage: { inputTokens: 100, outputTokens: 10 },
    }),
  };
  usageRecorder = { record: vi.fn().mockResolvedValue(undefined) };
  usecase = new ExtractTextFromImageUsecase(ocr, usageRecorder);
});

describe('ExtractTextFromImageUsecase', () => {
  it('画像から読み取った本文を返す', async () => {
    const result = await run();

    expect(result.text).toBe('読み取れた文字');
    expect(ocr.extractText).toHaveBeenCalledWith({
      image: expect.any(ArrayBuffer),
      mediaType: 'image/png',
    });
  });

  it('50文字を超える読み取り結果でも切り詰めずに返す（削るのはユーザーの判断）', async () => {
    const long = 'あ'.repeat(300);
    ocr.extractText = vi.fn().mockResolvedValue({
      text: long,
      model: 'claude-opus-5',
      usage: { inputTokens: 1, outputTokens: 1 },
    });

    const result = await run({ mediaType: 'image/jpeg' });

    expect(result.text).toBe(long);
  });

  it('1文字も読み取れなければ空文字を返す（エラーにはしない）', async () => {
    ocr.extractText = vi.fn().mockResolvedValue({
      text: '',
      model: 'claude-opus-5',
      usage: { inputTokens: 1, outputTokens: 1 },
    });

    const result = await run({ mediaType: 'image/webp' });

    expect(result.text).toBe('');
  });

  it('対応外の MIME タイプで BoardOcrValidationError を投げる', async () => {
    await expect(run({ mediaType: 'application/pdf' })).rejects.toThrow(BoardOcrValidationError);
    expect(ocr.extractText).not.toHaveBeenCalled();
  });

  it('空の画像で BoardOcrValidationError を投げる', async () => {
    await expect(run({ image: imageOf(0) })).rejects.toThrow(BoardOcrValidationError);
    expect(ocr.extractText).not.toHaveBeenCalled();
  });

  it('上限を超えるサイズで BoardOcrValidationError を投げる（OCR は呼ばない）', async () => {
    await expect(run({ image: imageOf(MAX_OCR_IMAGE_BYTES + 1) })).rejects.toThrow(
      BoardOcrValidationError,
    );
    expect(ocr.extractText).not.toHaveBeenCalled();
  });

  it('上限ちょうどのサイズは通す', async () => {
    const result = await run({ image: imageOf(MAX_OCR_IMAGE_BYTES) });

    expect(result.text).toBe('読み取れた文字');
  });
});

// OCR は呼び出しごとに残るレコードが無いので、ここで記録しないとコストが
// どこにも現れない（課金だけ発生して集計は $0）。実際そうなっていた。
describe('トークン使用量の記録', () => {
  it('読み取りに成功したら、使ったモデルとトークン数を記録する', async () => {
    await run();

    expect(usageRecorder.record).toHaveBeenCalledWith({
      userId: 'user-1',
      model: 'claude-opus-5',
      inputTokens: 100,
      outputTokens: 10,
    });
  });

  it('モデルは gateway が返したものをそのまま記録する（呼び出し側で決め打たない）', async () => {
    ocr.extractText = vi.fn().mockResolvedValue({
      text: 'x',
      model: 'some-other-model',
      usage: { inputTokens: 7, outputTokens: 3 },
    });

    await run();

    expect(usageRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'some-other-model', inputTokens: 7, outputTokens: 3 }),
    );
  });

  it('記録に失敗しても読み取り結果は返す（課金は既に発生していて取り返せない）', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    usageRecorder.record = vi
      .fn()
      .mockRejectedValue(new Error('relation "ocr_usage" does not exist'));

    const result = await run();

    expect(result.text).toBe('読み取れた文字');
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('入力の検証で弾かれた場合は記録しない（呼び出しが発生していない）', async () => {
    await expect(run({ mediaType: 'application/pdf' })).rejects.toThrow(BoardOcrValidationError);

    expect(usageRecorder.record).not.toHaveBeenCalled();
  });
});
