import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  LlmUsageEvent,
  LlmUsageRecorder,
} from '../domain/gateways/llm-usage-recorder.gateway.js';

/**
 * llm_usage_events に 1 行書く。
 *
 * 渡すクライアントは**リクエストしたユーザーの JWT で作ったもの**（authMiddleware の
 * `c.get('supabase')`）。RLS の insert ポリシーが `auth.uid() = user_id` なので、
 * 他人の user_id では書けない。service role は使わない。
 */
export class SupabaseLlmUsageRecorder implements LlmUsageRecorder {
  constructor(private supabase: SupabaseClient) {}

  async record(event: LlmUsageEvent): Promise<void> {
    const { error } = await this.supabase.from('llm_usage_events').insert({
      user_id: event.userId,
      feature: event.feature,
      model: event.model,
      input_tokens: event.inputTokens,
      output_tokens: event.outputTokens,
      succeeded: event.succeeded,
    });
    if (error) throw new Error(`llm_usage_events insert failed: ${error.message}`);
  }
}
