import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { SupabaseAiUsageRecorder } from '@/contexts/shared/infrastructure/supabase-ai-usage-recorder';

function fakeSupabase(result: { error: { message: string } | null }) {
  const insert = vi.fn().mockResolvedValue(result);
  const from = vi.fn().mockReturnValue({ insert });
  // @type-assertion-allowed: テスト用に from().insert() だけを持つ最小のスタブを SupabaseClient として渡す
  const client = { from } as unknown as SupabaseClient;
  return { client, from, insert };
}

const usage = {
  userId: 'user-1',
  feature: 'fermentation' as const,
  refId: 'ferm-1',
  inputTokens: 3105,
  outputTokens: 3898,
};

describe('SupabaseAiUsageRecorder', () => {
  it('ai_usage に 1 行書く（本文の列は持たない）', async () => {
    const { client, from, insert } = fakeSupabase({ error: null });

    await new SupabaseAiUsageRecorder(client).record(usage);

    expect(from).toHaveBeenCalledWith('ai_usage');
    expect(insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      feature: 'fermentation',
      ref_id: 'ferm-1',
      input_tokens: 3105,
      output_tokens: 3898,
    });
  });

  // 失敗を握りつぶすのは呼び出し側（recordAiUsage）の仕事。ここで黙ると、
  // 表が未作成のような設定ミスがどこにも出なくなる。
  it('書き込みに失敗したら例外にする', async () => {
    const { client } = fakeSupabase({
      error: { message: 'relation "ai_usage" does not exist' },
    });

    await expect(new SupabaseAiUsageRecorder(client).record(usage)).rejects.toThrow(
      'ai_usage insert failed',
    );
  });
});
