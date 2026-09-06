import type { SupabaseClient } from '@supabase/supabase-js';
import type { OcrUsageRecord, OcrUsageRecorder } from '../../domain/gateways/ocr-usage.recorder.js';

/**
 * ocr_usage への記録 (migration 00023)。
 *
 * ユーザー JWT のクライアントで insert する（service role を増やさない）。
 * RLS の `with check (user_id = auth.uid())` が他人の user_id での記録を弾く。
 */
export class SupabaseOcrUsageRepository implements OcrUsageRecorder {
  constructor(private supabase: SupabaseClient) {}

  async record(usage: OcrUsageRecord): Promise<void> {
    const { error } = await this.supabase.from('ocr_usage').insert({
      user_id: usage.userId,
      model: usage.model,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
    });
    if (error) throw new Error(error.message);
  }
}
