import type { NewsletterAudienceGateway } from '../../domain/gateways/newsletter-audience.gateway.js';
import type { NewsletterRepositoryGateway } from '../../domain/gateways/newsletter-repository.gateway.js';
import {
  renderNewsletterHtml,
  renderNewsletterText,
} from '../../domain/services/newsletter-content.service.js';
import { NewsletterNotFoundError } from '../errors/newsletter.errors.js';

export interface NewsletterPreview {
  id: string;
  subject: string;
  html: string;
  text: string;
  /** その場で数え直した宛先数。「何名に送られるか」の表示に使う。 */
  recipientCount: number;
  /** すでに送信済みか。画面側で送信ボタンを出すかの判断に使う。 */
  sendable: boolean;
}

/**
 * 送信前の確認材料をまとめて返す。
 *
 * issue #614 の制約「送信時に HTML プレビュー・宛先数・確認ボタン」のうち
 * 前の 2 つがこれ。宛先数は保存された値ではなく **その時点で数え直す**
 * （下書きを書いてから送るまでに登録者が増減するため）。
 */
export class PreviewNewsletterUsecase {
  constructor(
    private repository: NewsletterRepositoryGateway,
    private audience: NewsletterAudienceGateway,
  ) {}

  async execute(id: string): Promise<NewsletterPreview> {
    const newsletter = await this.repository.findById(id);
    if (!newsletter) throw new NewsletterNotFoundError(id);

    const content = { subject: newsletter.subject, bodyMarkdown: newsletter.bodyMarkdown };
    const recipientCount = await this.audience.countRecipients();

    return {
      id: newsletter.id,
      subject: newsletter.subject,
      html: renderNewsletterHtml(content),
      text: renderNewsletterText(content),
      recipientCount,
      sendable: newsletter.status === 'draft' && recipientCount > 0,
    };
  }
}
