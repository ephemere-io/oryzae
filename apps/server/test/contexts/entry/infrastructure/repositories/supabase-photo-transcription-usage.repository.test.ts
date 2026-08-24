import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PhotoTranscriptionUsage } from '@/contexts/entry/domain/models/photo-transcription-usage';
import { SupabasePhotoTranscriptionUsageRepository } from '@/contexts/entry/infrastructure/repositories/supabase-photo-transcription-usage.repository';

describe('SupabasePhotoTranscriptionUsageRepository', () => {
  const insert = vi.fn();
  const from = vi.fn(() => ({ insert }));

  // @type-assertion-allowed: SupabaseClient は多数のメソッドを持つが、この repository が
  // 触るのは from().insert() のみ。テストで必要な最小限だけスタブする。
  const supabase = { from } as unknown as SupabaseClient;
  const repo = new SupabasePhotoTranscriptionUsageRepository(supabase);

  const usage = PhotoTranscriptionUsage.fromProps({
    id: 'usage-1',
    userId: 'user-1',
    model: 'claude-sonnet-5',
    inputTokens: 1800,
    outputTokens: 40,
    charCount: 120,
    createdAt: '2026-08-24T00:00:00.000Z',
  });

  beforeEach(() => {
    from.mockClear();
    insert.mockReset().mockResolvedValue({ error: null });
  });

  it('snake_case に変換して photo_transcription_usages に insert する', async () => {
    await repo.save(usage);

    expect(from).toHaveBeenCalledWith('photo_transcription_usages');
    expect(insert).toHaveBeenCalledWith({
      id: 'usage-1',
      user_id: 'user-1',
      model: 'claude-sonnet-5',
      input_tokens: 1800,
      output_tokens: 40,
      char_count: 120,
      created_at: '2026-08-24T00:00:00.000Z',
    });
  });

  it('起こした文字そのものは保存しない', async () => {
    await repo.save(usage);

    const row = insert.mock.calls[0][0];
    expect(Object.keys(row)).not.toContain('text');
    expect(Object.keys(row)).not.toContain('content');
  });

  it('insert が失敗したら投げる', async () => {
    insert.mockResolvedValue({ error: new Error('insert failed') });

    await expect(repo.save(usage)).rejects.toThrow('insert failed');
  });
});
