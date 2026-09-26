import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserActivityStatsRepositoryGateway } from '../../domain/gateways/user-activity-stats-repository.gateway.js';

/**
 * Issue #316: Supabase 実装。`entries` / `entry_question_links` / `questions` /
 * `fermentation_results` テーブルに直接問い合わせる (entry / question / fermentation
 * コンテキストの repository を経由しない)。
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

  async hasQuestion(userId: string): Promise<boolean> {
    // アーカイブ済み (is_archived=true) も含めて数える。五歩の ① は「立てたことがあるか」。
    const { data, error } = await this.supabase
      .from('questions')
      .select('id')
      .eq('user_id', userId)
      .limit(1);
    if (error) throw error;
    return (data ?? []).length > 0;
  }

  async hasEntry(userId: string): Promise<boolean> {
    // 漬け込みの有無は問わない。五歩の ② は「書いたことがあるか」。
    const { data, error } = await this.supabase
      .from('entries')
      .select('id')
      .eq('user_id', userId)
      .limit(1);
    if (error) throw error;
    return (data ?? []).length > 0;
  }

  async hasReadLetter(userId: string): Promise<boolean> {
    // 既読は fermentation_results.read_at に残る（POST /api/v1/fermentations/read が書く。
    // migration 00027）。届いただけの手紙は数えない — 五歩の ⑤ は「読んだか」。
    const { data, error } = await this.supabase
      .from('fermentation_results')
      .select('id')
      .eq('user_id', userId)
      .not('read_at', 'is', null)
      .limit(1);
    if (error) {
      // migration 00027 が DB にまだ当たっていない間だけ、「未読」に倒す。users/me は書斎の
      // 入口で毎回呼ばれるので、旗 1 つのために 500 にしない。他の失敗はそのまま投げる
      // （どのカラムがどう違ったかが分かる例外にしておく）。
      if (isUndefinedColumn(error)) {
        console.warn('[users/me] fermentation_results.read_at が無い（migration 00027 未適用）');
        return false;
      }
      throw error;
    }
    return (data ?? []).length > 0;
  }
}

/** PostgREST の「カラムが無い」（PostgreSQL 42703 undefined_column）。 */
function isUndefinedColumn(error: { code?: string; message?: string }): boolean {
  return error.code === '42703' || (error.message ?? '').includes('read_at');
}
