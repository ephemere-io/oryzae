import type { SupabaseClient } from '@supabase/supabase-js';
import type { NewsletterSubscriptionRepositoryGateway } from '../../domain/gateways/newsletter-subscription-repository.gateway.js';

/**
 * 配信停止フラグの読み書き。
 *
 * 呼び出し元はログイン不要の公開エンドポイントなので、渡される SupabaseClient は
 * service role（ユーザー JWT が存在しないため RLS を効かせられない）。
 * **user_id はリクエスト本文ではなく HMAC 検証済みトークンから来る** ことが
 * 安全性の根拠。routes 側でそれを崩さないこと。
 */
export class SupabaseNewsletterSubscriptionRepository
  implements NewsletterSubscriptionRepositoryGateway
{
  constructor(private supabase: SupabaseClient) {}

  async setOptOut(userId: string, optOut: boolean): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('profiles')
      .update({ newsletter_opt_out: optOut, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('id');

    if (error) throw error;
    return (data ?? []).length > 0;
  }
}
