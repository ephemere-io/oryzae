import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserActivityStatsRepositoryGateway } from '../../domain/gateways/user-activity-stats-repository.gateway.js';

/**
 * Issue #316: Supabase 実装。`entries` / `entry_question_links` テーブルに
 * 直接問い合わせる (entry / question コンテキストの repository を経由しない)。
 * 行が 1 件あるかだけ判定すればよいので `limit(1)` でコストを抑える。
 */
export class SupabaseUserActivityStatsRepository implements UserActivityStatsRepositoryGateway {
  constructor(private supabase: SupabaseClient) {}

  async hasPickled(userId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('entries')
      .select('id')
      .eq('user_id', userId)
      .eq('fermentation_enabled', true)
      .limit(1);
    if (error) throw error;
    return (data ?? []).length > 0;
  }

  async hasLinkedQuestion(userId: string): Promise<boolean> {
    // entry_question_links.entry_id → entries.user_id を inner join で絞り込む
    const { data, error } = await this.supabase
      .from('entry_question_links')
      .select('entry_id, entries!inner(user_id)')
      .eq('entries.user_id', userId)
      .limit(1);
    if (error) throw error;
    return (data ?? []).length > 0;
  }
}
