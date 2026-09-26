import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { SupabaseOcrUsageRecorder } from '@/contexts/shared/infrastructure/supabase-ocr-usage-recorder';

function fakeSupabase(result: { error: { message: string } | null }) {
  const insert = vi.fn().mockResolvedValue(result);
  const from = vi.fn().mockReturnValue({ insert });
  // @type-assertion-allowed: テスト用に from().insert() だけを持つ最小のスタブを SupabaseClient として渡す
  const client = { from } as unknown as SupabaseClient;
  return { client, from, insert };
}

const event = {
  userId: 'user-1',
  source: 'board' as const,
  model: 'claude-sonnet-5',
  inputTokens: 1200,
  outputTokens: 24,
  succeeded: true,
};

describe('SupabaseOcrUsageRecorder', () => {
  it('ocr_usage_events に 1 行書く（本文の列は持たない）', async () => {
    const { client, from, insert } = fakeSupabase({ error: null });

    await new SupabaseOcrUsageRecorder(client).record(event);

    expect(from).toHaveBeenCalledWith('ocr_usage_events');
    expect(insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      source: 'board',
      model: 'claude-sonnet-5',
      input_tokens: 1200,
      output_tokens: 24,
      succeeded: true,
    });
  });

  // 失敗を握りつぶすのは呼び出し側（recordOcrUsage）の仕事。ここで黙ると、
  // テーブル未作成のような設定ミスがどこにも出なくなる。
  it('書き込みに失敗したら例外にする', async () => {
    const { client } = fakeSupabase({
      error: { message: 'relation "ocr_usage_events" does not exist' },
    });

    await expect(new SupabaseOcrUsageRecorder(client).record(event)).rejects.toThrow(
      'ocr_usage_events insert failed',
    );
  });
});
