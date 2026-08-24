import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EntryValidationError } from '@/contexts/entry/application/errors/entry.errors';
import { TranscribeEntryPhotoUsecase } from '@/contexts/entry/application/usecases/transcribe-entry-photo.usecase';
import type { PhotoTranscriptionGateway } from '@/contexts/entry/domain/gateways/photo-transcription.gateway';
import type { PhotoTranscriptionUsageRepositoryGateway } from '@/contexts/entry/domain/gateways/photo-transcription-usage-repository.gateway';

describe('TranscribeEntryPhotoUsecase', () => {
  let transcription: PhotoTranscriptionGateway;
  let usageRepo: PhotoTranscriptionUsageRepositoryGateway;
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
    usageRepo = { save: vi.fn().mockResolvedValue(undefined) };
    usecase = new TranscribeEntryPhotoUsecase(transcription, usageRepo, () => 'usage-1');
  });

  it('起こした文字を返す（トークン数は返さない）', async () => {
    const result = await usecase.execute(input);

    expect(result).toEqual({ text: '今日は雨だった。' });
    expect(transcription.transcribe).toHaveBeenCalledWith(input.file, 'image/jpeg', 'ja');
  });

  it('トークン使用量をモデル名つきで記録する', async () => {
    await usecase.execute(input);

    expect(usageRepo.save).toHaveBeenCalledTimes(1);
    const saved = vi.mocked(usageRepo.save).mock.calls[0][0].toProps();
    expect(saved).toMatchObject({
      id: 'usage-1',
      userId: 'user-1',
      model: 'claude-sonnet-5',
      inputTokens: 1800,
      outputTokens: 40,
      charCount: '今日は雨だった。'.length,
    });
  });

  it('ロケールをそのまま gateway に渡す', async () => {
    await usecase.execute({ ...input, contentType: 'image/png', language: 'en' });

    expect(transcription.transcribe).toHaveBeenCalledWith(expect.anything(), 'image/png', 'en');
  });

  it('文字が写っていない写真でも使用量は記録する（実費は発生しているため）', async () => {
    vi.mocked(transcription.transcribe).mockResolvedValue({
      text: '',
      model: 'claude-sonnet-5',
      inputTokens: 1500,
      outputTokens: 1,
    });

    const result = await usecase.execute(input);

    expect(result.text).toBe('');
    expect(usageRepo.save).toHaveBeenCalledTimes(1);
    expect(vi.mocked(usageRepo.save).mock.calls[0][0].charCount).toBe(0);
  });

  it('gateway が壊れた値を返したら記録せず ValidationError', async () => {
    vi.mocked(transcription.transcribe).mockResolvedValue({
      text: 'x',
      model: '',
      inputTokens: 10,
      outputTokens: 1,
    });

    await expect(usecase.execute(input)).rejects.toThrow(EntryValidationError);
    expect(usageRepo.save).not.toHaveBeenCalled();
  });

  it('文字起こしが失敗したらそのまま伝播し、記録もしない', async () => {
    vi.mocked(transcription.transcribe).mockRejectedValue(new Error('llm unavailable'));

    await expect(usecase.execute(input)).rejects.toThrow('llm unavailable');
    expect(usageRepo.save).not.toHaveBeenCalled();
  });
});
