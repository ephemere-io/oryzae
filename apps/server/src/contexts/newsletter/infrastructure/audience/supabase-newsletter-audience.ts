import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  NewsletterAudienceGateway,
  NewsletterRecipient,
} from '../../domain/gateways/newsletter-audience.gateway.js';

const PER_PAGE = 1000;
/**
 * 取り切れなかったときに黙って打ち切らないための上限。
 * Research Preview の登録枠（MAX_USER_COUNT）を大きく超える値にしてある。
 */
const MAX_PAGES = 20;

/**
 * 一斉配信の宛先 = 「メールを確認済みで、配信停止していない登録者」。
 *
 * ## なぜ email_confirmed_at を要求するか
 *
 * 未確認のアドレスは、本人のものである保証が無い（他人のアドレスで登録した
 * だけかもしれない）。fermentation の digest と同じ基準にしてある。
 *
 * ## なぜ profiles を引くか
 *
 * 配信停止は profiles.newsletter_opt_out に持つ（00024）。Supabase Auth 側の
 * user_metadata に置くと、ユーザー自身が触れるメタデータと同じ場所になり、
 * 「止めたはずが戻っている」事故を作りうる。
 */
export class SupabaseNewsletterAudience implements NewsletterAudienceGateway {
  constructor(private supabase: SupabaseClient) {}

  /**
   * 人数だけが欲しい場合も一度は列挙する。
   *
   * Supabase Auth に「メール確認済みユーザー数」を返す口が無いため、
   * 数えるにはページングして見るしかない。安く見せるために profiles の行数で
   * 代用すると、確認済み判定と配信停止が反映されず **画面の人数と実際の
   * 送信数がずれる**。ずれた数字を確認画面に出すくらいなら同じ経路で数える。
   */
  async countRecipients(): Promise<number> {
    return (await this.listRecipients()).length;
  }

  async listRecipients(): Promise<NewsletterRecipient[]> {
    const optedOut = await this.fetchOptedOutUserIds();
    const recipients: NewsletterRecipient[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
      const { data, error } = await this.supabase.auth.admin.listUsers({
        page,
        perPage: PER_PAGE,
      });
      if (error) throw error;

      const users = data?.users ?? [];
      for (const user of users) {
        if (!user.email) continue;
        if (!user.email_confirmed_at) continue;
        if (optedOut.has(user.id)) continue;
        recipients.push({ userId: user.id, email: user.email });
      }

      if (users.length < PER_PAGE) return recipients;
    }

    // ここに来たら登録者が MAX_PAGES * PER_PAGE を超えている。取りこぼした
    // ぶんに送られないまま「全員に送った」と見えるのが一番まずいので、
    // 件数だけ残して気づけるようにする（本文・アドレスは載せない）。
    console.warn('[SupabaseNewsletterAudience] recipient pagination hit MAX_PAGES', {
      maxPages: MAX_PAGES,
      perPage: PER_PAGE,
      collected: recipients.length,
    });
    return recipients;
  }

  private async fetchOptedOutUserIds(): Promise<Set<string>> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('id')
      .eq('newsletter_opt_out', true);

    if (error) throw error;
    return new Set((data ?? []).map((row: { id: string }) => row.id));
  }
}
