import type { NewsletterSubscriptionRepositoryGateway } from '../../domain/gateways/newsletter-subscription-repository.gateway.js';
import type { UnsubscribeTokenGateway } from '../../domain/gateways/unsubscribe-token.gateway.js';
import { NewsletterInvalidUnsubscribeTokenError } from '../errors/newsletter.errors.js';

/**
 * メールの配信停止リンクからの購読切り替え（ログイン不要）。
 *
 * トークンの署名だけが本人性の根拠なので、**user_id をリクエストから受け取らない**。
 * 受け取れる形にすると「他人の id を入れて止める」が成立する。
 */
export class SetNewsletterSubscriptionUsecase {
  constructor(
    private tokens: UnsubscribeTokenGateway,
    private repository: NewsletterSubscriptionRepositoryGateway,
  ) {}

  async execute(params: { token: string; optOut: boolean }): Promise<{ optOut: boolean }> {
    const userId = this.tokens.verify(params.token);
    // 「トークンが壊れている」と「その利用者がもういない」を同じ応答にする。
    // 公開エンドポイントなので、トークンを変えながら叩いて実在する id を
    // 探れる差を作らない。
    if (!userId) throw new NewsletterInvalidUnsubscribeTokenError();

    const found = await this.repository.setOptOut(userId, params.optOut);
    if (!found) throw new NewsletterInvalidUnsubscribeTokenError();

    return { optOut: params.optOut };
  }
}
