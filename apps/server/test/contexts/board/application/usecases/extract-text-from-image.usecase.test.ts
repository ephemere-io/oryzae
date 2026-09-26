import { MAX_OCR_IMAGE_BYTES } from '@oryzae/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardOcrValidationError } from '@/contexts/board/application/errors/board.errors';
import { ExtractTextFromImageUsecase } from '@/contexts/board/application/usecases/extract-text-from-image.usecase';
import type { OcrGateway } from '@/contexts/board/domain/gateways/ocr.gateway';
import type { OcrUsageRecorder } from '@/contexts/shared/domain/gateways/ocr-usage-recorder.gateway';

let ocr: OcrGateway;
let usage: OcrUsageRecorder;
let usecase: ExtractTextFromImageUsecase;

const USER_ID = 'user-1';

function imageOf(bytes: number): ArrayBuffer {
  return new ArrayBuffer(bytes);
}

beforeEach(() => {
  ocr = {
    extractText: vi.fn().mockResolvedValue({
      text: '読み取れた文字',
      model: 'claude-sonnet-5',
      usage: { inputTokens: 100, outputTokens: 10 },
    }),
  };
  usage = { record: vi.fn().mockResolvedValue(undefined) };
  usecase = new ExtractTextFromImageUsecase(ocr, usage);
});

describe('ExtractTextFromImageUsecase', () => {
  it('画像から読み取った本文を返す', async () => {
    const result = await usecase.execute({
      userId: USER_ID,
      image: imageOf(1024),
      mediaType: 'image/png',
    });

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
      model: 'claude-sonnet-5',
      usage: { inputTokens: 1, outputTokens: 1 },
    });

    const result = await usecase.execute({
      userId: USER_ID,
      image: imageOf(1024),
      mediaType: 'image/jpeg',
    });

    expect(result.text).toBe(long);
  });

  it('1文字も読み取れなければ空文字を返す（エラーにはしない）', async () => {
    ocr.extractText = vi.fn().mockResolvedValue({
      text: '',
      model: 'claude-sonnet-5',
      usage: { inputTokens: 1, outputTokens: 1 },
    });

    const result = await usecase.execute({
      userId: USER_ID,
      image: imageOf(1024),
      mediaType: 'image/webp',
    });

    expect(result.text).toBe('');
  });

  it('対応外の MIME タイプで BoardOcrValidationError を投げる', async () => {
    await expect(
      usecase.execute({ userId: USER_ID, image: imageOf(1024), mediaType: 'application/pdf' }),
    ).rejects.toThrow(BoardOcrValidationError);
    expect(ocr.extractText).not.toHaveBeenCalled();
  });

  it('空の画像で BoardOcrValidationError を投げる', async () => {
    await expect(
      usecase.execute({ userId: USER_ID, image: imageOf(0), mediaType: 'image/png' }),
    ).rejects.toThrow(BoardOcrValidationError);
    expect(ocr.extractText).not.toHaveBeenCalled();
  });

  it('上限を超えるサイズで BoardOcrValidationError を投げる（OCR は呼ばない）', async () => {
    await expect(
      usecase.execute({
        userId: USER_ID,
        image: imageOf(MAX_OCR_IMAGE_BYTES + 1),
        mediaType: 'image/png',
      }),
    ).rejects.toThrow(BoardOcrValidationError);
    expect(ocr.extractText).not.toHaveBeenCalled();
  });

  it('上限ちょうどのサイズは通す', async () => {
    const result = await usecase.execute({
      userId: USER_ID,
      image: imageOf(MAX_OCR_IMAGE_BYTES),
      mediaType: 'image/png',
    });

    expect(result.text).toBe('読み取れた文字');
  });

  describe('利用記録（日次レポートの「誰が使ったか」）', () => {
    it('成功したら、誰が・どのモデルで・何トークン使ったかを記録する（本文は渡さない）', async () => {
      await usecase.execute({ userId: USER_ID, image: imageOf(1024), mediaType: 'image/png' });

      expect(usage.record).toHaveBeenCalledWith({
        userId: USER_ID,
        source: 'board',
        model: 'claude-sonnet-5',
        inputTokens: 100,
        outputTokens: 10,
        succeeded: true,
      });
    });

    it('OCR が失敗したら、失敗として記録してからエラーを伝播する', async () => {
      ocr.extractText = vi.fn().mockRejectedValue(new Error('llm unavailable'));

      await expect(
        usecase.execute({ userId: USER_ID, image: imageOf(1024), mediaType: 'image/png' }),
      ).rejects.toThrow('llm unavailable');
      expect(usage.record).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'board', succeeded: false, model: null }),
      );
    });

    it('入力検証で弾いたものは LLM を呼んでいないので記録しない', async () => {
      await expect(
        usecase.execute({ userId: USER_ID, image: imageOf(0), mediaType: 'image/png' }),
      ).rejects.toThrow(BoardOcrValidationError);

      expect(usage.record).not.toHaveBeenCalled();
    });

    // 記録はレポートのため。記録テーブルが無い・DB が一時的に落ちている、で
    // ユーザーの OCR まで失敗させない。
    it('記録に失敗しても、読み取った本文は返す', async () => {
      usage.record = vi.fn().mockRejectedValue(new Error('relation does not exist'));
      const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await usecase.execute({
        userId: USER_ID,
        image: imageOf(1024),
        mediaType: 'image/png',
      });

      expect(result.text).toBe('読み取れた文字');
      expect(errorLog).toHaveBeenCalled();
      errorLog.mockRestore();
    });
  });
});
