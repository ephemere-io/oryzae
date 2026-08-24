import { describe, expect, it } from 'vitest';
import { PhotoTranscriptionUsage } from '@/contexts/entry/domain/models/photo-transcription-usage';

describe('PhotoTranscriptionUsage', () => {
  const valid = {
    userId: 'user-1',
    model: 'claude-sonnet-5',
    inputTokens: 1800,
    outputTokens: 40,
    charCount: 120,
  };

  describe('create', () => {
    it('使用量を作れる', () => {
      const result = PhotoTranscriptionUsage.create(valid, () => 'usage-1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.id).toBe('usage-1');
        expect(result.value.userId).toBe('user-1');
        expect(result.value.model).toBe('claude-sonnet-5');
        expect(result.value.inputTokens).toBe(1800);
        expect(result.value.outputTokens).toBe(40);
        expect(result.value.charCount).toBe(120);
        expect(result.value.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      }
    });

    it('トークン 0・文字数 0（文字が写っていない写真）も記録できる', () => {
      const result = PhotoTranscriptionUsage.create(
        { ...valid, inputTokens: 0, outputTokens: 0, charCount: 0 },
        () => 'usage-1',
      );

      expect(result.success).toBe(true);
    });

    it('モデル名が空ならエラー', () => {
      const result = PhotoTranscriptionUsage.create({ ...valid, model: '   ' }, () => 'usage-1');

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.type).toBe('EMPTY_MODEL');
    });

    it('負のトークン数はエラー', () => {
      for (const patch of [{ inputTokens: -1 }, { outputTokens: -1 }, { charCount: -1 }]) {
        const result = PhotoTranscriptionUsage.create({ ...valid, ...patch }, () => 'usage-1');
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error.type).toBe('NEGATIVE_TOKENS');
      }
    });
  });

  it('fromProps / toProps がラウンドトリップする', () => {
    const props = {
      id: 'usage-1',
      userId: 'user-1',
      model: 'claude-sonnet-5',
      inputTokens: 1800,
      outputTokens: 40,
      charCount: 120,
      createdAt: '2026-08-24T00:00:00.000Z',
    };

    expect(PhotoTranscriptionUsage.fromProps(props).toProps()).toEqual(props);
  });
});
