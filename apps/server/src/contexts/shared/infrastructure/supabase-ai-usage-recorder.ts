import type { SupabaseClient } from '@supabase/supabase-js';
import type { AiUsage, AiUsageRecorder } from '../domain/gateways/ai-usage-recorder.gateway.js';

/**
 * ai_usage に 1 行書く。
 *
 * 渡すクライアントは、その機能がもともと使っているもの:
 *   - OCR: リクエストしたユーザーの JWT で作ったもの（`c.get('supabase')`）。
 *     RLS の insert ポリシーが `auth.uid() = user_id` なので他人の user_id では書けない
 *   - 発酵: 発酵の repository と同じクライアント（cron・管理画面は service role）
 * この記録のために service role を新しく使うことはない。
 */
export class SupabaseAiUsageRecorder implements AiUsageRecorder {
  constructor(private supabase: SupabaseClient) {}

  async record(usage: AiUsage): Promise<void> {
    const { error } = await this.supabase.from('ai_usage').insert({
      user_id: usage.userId,
      feature: usage.feature,
      ref_id: usage.refId,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
    });
    if (error) throw new Error(`ai_usage insert failed: ${error.message}`);
  }
}
