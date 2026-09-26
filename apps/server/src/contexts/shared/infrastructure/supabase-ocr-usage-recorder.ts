import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  OcrUsageEvent,
  OcrUsageRecorder,
} from '../domain/gateways/ocr-usage-recorder.gateway.js';

/**
 * ocr_usage_events に 1 行書く。
 *
 * 渡すクライアントは**リクエストしたユーザーの JWT で作ったもの**（authMiddleware の
 * `c.get('supabase')`）。RLS の insert ポリシーが `auth.uid() = user_id` なので、
 * 他人の user_id では書けない。service role は使わない。
 */
export class SupabaseOcrUsageRecorder implements OcrUsageRecorder {
  constructor(private supabase: SupabaseClient) {}

  async record(event: OcrUsageEvent): Promise<void> {
    const { error } = await this.supabase.from('ocr_usage_events').insert({
      user_id: event.userId,
      source: event.source,
      model: event.model,
      input_tokens: event.inputTokens,
      output_tokens: event.outputTokens,
      succeeded: event.succeeded,
    });
    if (error) throw new Error(`ocr_usage_events insert failed: ${error.message}`);
  }
}
