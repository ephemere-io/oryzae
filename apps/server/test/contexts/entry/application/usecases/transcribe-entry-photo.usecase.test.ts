import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TranscribeEntryPhotoUsecase } from '@/contexts/entry/application/usecases/transcribe-entry-photo.usecase';
import type { PhotoTranscriptionGateway } from '@/contexts/entry/domain/gateways/photo-transcription.gateway';
import { SpendLimitReachedError } from '@/contexts/shared/application/errors/application.errors';
import type { LlmUsageRecorder } from '@/contexts/shared/domain/gateways/llm-usage-recorder.gateway';

describe('TranscribeEntryPhotoUsecase', () => {
  let transcription: PhotoTranscriptionGateway;
  let usage: LlmUsageRecorder;
  let usecase: TranscribeEntryPhotoUsecase;

  const input = {
    userId: 'user-1',
    file: new ArrayBuffer(8),
    contentType: 'image/jpeg',
    language: 'ja',
  };

  beforeEach(() => {
    transcription = {
      transcribe: vi.fn().mockResolvedValue({
        text: '今日は雨だった。',
        model: 'claude-sonnet-5',
        inputTokens: 1800,
        outputTokens: 40,
      }),
    };
    usage = { record: vi.fn().mockResolvedValue(undefined) };
    usecase = new TranscribeEntryPhotoUsecase(transcription, usage);
  });

  it('起こした文字だけを返す', async () => {
    const result = await usecase.execute(input);

    expect(result).toEqual({ text: '今日は雨だった。' });
    expect(transcription.transcribe).toHaveBeenCalledWith(input.file, 'image/jpeg', 'ja');
  });

  it('ロケールをそのまま gateway に渡す', async () => {
    await usecase.execute({ ...input, contentType: 'image/png', language: 'en' });

    expect(transcription.transcribe).toHaveBeenCalledWith(expect.anything(), 'image/png', 'en');
  });

  it('文字が写っていない写真では空文字が返る', async () => {
    vi.mocked(transcription.transcribe).mockResolvedValue({
      text: '',
      model: 'claude-sonnet-5',
      inputTokens: 1500,
      outputTokens: 1,
    });

    expect((await usecase.execute(input)).text).toBe('');
  });

  it('文字起こしが失敗したらそのまま伝播する', async () => {
    vi.mocked(transcription.transcribe).mockRejectedValue(new Error('llm unavailable'));

    await expect(usecase.execute(input)).rejects.toThrow('llm unavailable');
  });

  // 支出上限で止まっているだけなのに「読み取れませんでした」と出すと、
  // ユーザーにも運用側にも原因が分からない。専用のエラーに変換する。
  it('支出上限に達したときは SpendLimitReachedError に変換する', async () => {
    vi.mocked(transcription.transcribe).mockRejectedValue({
      status: 400,
      message: 'You have reached your specified API usage limits',
    });

    await expect(usecase.execute(input)).rejects.toThrow(SpendLimitReachedError);
  });

  it('通常のレート制限は SpendLimitReachedError にしない（待てば直るため）', async () => {
    vi.mocked(transcription.transcribe).mockRejectedValue({
      status: 429,
      message: 'Number of requests has exceeded your rate limit',
    });

    await expect(usecase.execute(input)).rejects.not.toBeInstanceOf(SpendLimitReachedError);
  });

  describe('利用記録（日次レポートの「誰が使ったか」）', () => {
    it('成功したら、誰が・どのモデルで・何トークン使ったかを記録する（起こした文字は渡さない）', async () => {
      await usecase.execute(input);

      expect(usage.record).toHaveBeenCalledWith({
        userId: 'user-1',
        feature: 'ocr_entry',
        model: 'claude-sonnet-5',
        inputTokens: 1800,
        outputTokens: 40,
        succeeded: true,
      });
    });

    it('失敗したら、失敗として記録してからエラーを伝播する', async () => {
      vi.mocked(transcription.transcribe).mockRejectedValue(new Error('llm unavailable'));

      await expect(usecase.execute(input)).rejects.toThrow('llm unavailable');
      expect(usage.record).toHaveBeenCalledWith(
        expect.objectContaining({ feature: 'ocr_entry', succeeded: false, model: null }),
      );
    });

    it('記録に失敗しても、起こした文字は返す', async () => {
      usage.record = vi.fn().mockRejectedValue(new Error('relation does not exist'));
      const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect((await usecase.execute(input)).text).toBe('今日は雨だった。');
      expect(errorLog).toHaveBeenCalled();
      errorLog.mockRestore();
    });
  });
});
