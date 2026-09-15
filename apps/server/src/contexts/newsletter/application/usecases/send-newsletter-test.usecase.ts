import type {
  BulkEmailMessage,
  BulkEmailSenderGateway,
} from '../../domain/gateways/bulk-email-sender.gateway.js';
import type { NewsletterAudienceGateway } from '../../domain/gateways/newsletter-audience.gateway.js';
import type { NewsletterRepositoryGateway } from '../../domain/gateways/newsletter-repository.gateway.js';
import type { NewsletterTranslationRepositoryGateway } from '../../domain/gateways/newsletter-translation-repository.gateway.js';
import {
  type UnsubscribeTokenGateway,
  UnsubscribeTokenUnavailableError,
} from '../../domain/gateways/unsubscribe-token.gateway.js';
import type { NewsletterProps } from '../../domain/models/newsletter.js';
import {
  isTranslatableLocale,
  NEWSLETTER_LOCALES,
  NEWSLETTER_SOURCE_LOCALE,
  type NewsletterLocale,
} from '../../domain/models/newsletter-locale.js';
import {
  buildUnsubscribeUrl,
  renderNewsletterHtml,
  renderNewsletterText,
  withTestSubjectPrefix,
} from '../../domain/services/newsletter-content.service.js';
import { resolveLocalizedContent } from '../../domain/services/newsletter-delivery.service.js';
import {
  NewsletterNotFoundError,
  NewsletterUnsubscribeUnavailableError,
  NewsletterValidationError,
} from '../errors/newsletter.errors.js';

export interface SendNewsletterTestResult {
  newsletter: NewsletterProps;
  sent: boolean;
  reason?: 'disabled' | 'no-api-key';
  delivered: number;
  failed: number;
  /**
   * 送り先。**テスト配信に限りアドレスを返す。**
   *
   * 本番配信では宛先を返さない（他人のアドレスを画面に並べない）が、ここは
   * 運営者自身の 2〜3 件で、しかも「どこに届くはずか」が分からないと受信確認の
   * しようがない。届かなかったときに、送り先が違うのか届いていないのかを
   * 切り分けられる必要がある。
   */
  recipients: string[];
  /** どの言語版を送ったか。運営者はこの本数ぶんメールを受け取る。 */
  locales: NewsletterLocale[];
}

/**
 * 本番配信の前に、運営者だけへ送って受信確認する (issue #614 フォロー)。
 *
 * ## 本番と何が違うか
 *
 * - 宛先が `listTestRecipients()`（＝管理画面に入れる人）だけ
 * - 件名に `[テスト配信]` が付く（受信箱で本番と見分けるため）
 * - **status を動かさない。** テスト配信は配信ではない。sending にも sent にも
 *   しないので、何度でもやり直せるし、そのあと普通に本番配信できる
 * - 記録するのは `test_sent_at` だけ
 *
 * ## 本文は本番と同一
 *
 * 件名の印以外は本番とまったく同じものを送る。配信停止リンクも**本物**
 * （署名済みトークン）を載せる —— そこを差し替えると、リンクが本当に効くかを
 * 確かめられない。押せば運営者自身が配信停止になるが、そのページから
 * 「やっぱり受け取る」で戻せる。
 */
export class SendNewsletterTestUsecase {
  constructor(
    private repository: NewsletterRepositoryGateway,
    private audience: NewsletterAudienceGateway,
    private sender: BulkEmailSenderGateway,
    private tokens: UnsubscribeTokenGateway,
    private translations: NewsletterTranslationRepositoryGateway,
  ) {}

  async execute(id: string): Promise<SendNewsletterTestResult> {
    const newsletter = await this.repository.findById(id);
    if (!newsletter) throw new NewsletterNotFoundError(id);

    // 送信済みの文面をテストしても意味が無い（もう変えられない）。
    if (newsletter.status !== 'draft') {
      throw new NewsletterValidationError(
        '下書きのみテスト配信できます（この配信はすでに送信済み、または送信中です）',
      );
    }

    const recipients = await this.audience.listTestRecipients();
    if (recipients.length === 0) {
      throw new NewsletterValidationError(
        'テスト配信の宛先がいません（管理者ユーザーが見つかりませんでした）',
      );
    }

    const source = { subject: newsletter.subject, bodyMarkdown: newsletter.bodyMarkdown };
    const translations = await this.translations.listByNewsletterId(id);

    // **用意できている言語版を全部** 運営者へ送る。1 言語ずつ確認していると、
    // 訳が崩れている言語に気づかないまま本番を撃つ。原文の言語は常に送る。
    const locales = NEWSLETTER_LOCALES.filter(
      (locale) =>
        locale === NEWSLETTER_SOURCE_LOCALE ||
        (isTranslatableLocale(locale) &&
          resolveLocalizedContent(locale, source, translations) !== null),
    );

    let messages: BulkEmailMessage[];
    try {
      messages = recipients.flatMap((recipient) =>
        locales.map((locale) => {
          const localized = resolveLocalizedContent(locale, source, translations);
          // locales は解決できたものだけなので、ここで null にはならない。
          if (!localized) throw new NewsletterValidationError(`${locale} の翻訳を解決できません`);

          const unsubscribeUrl = buildUnsubscribeUrl(this.tokens.issue(recipient.userId));
          const content = {
            subject: localized.subject,
            bodyMarkdown: localized.bodyMarkdown,
            unsubscribeUrl,
            locale,
          };
          return {
            to: recipient.email,
            subject: withTestSubjectPrefix(localized.subject, locale),
            html: renderNewsletterHtml(content),
            text: renderNewsletterText(content),
            unsubscribeUrl,
          };
        }),
      );
    } catch (error) {
      if (error instanceof UnsubscribeTokenUnavailableError) {
        throw new NewsletterUnsubscribeUnavailableError(error.message);
      }
      throw error;
    }

    const outcome = await this.sender.sendBulk(messages);
    const recipientEmails = recipients.map((r) => r.email);

    if (!outcome.sent) {
      // 送れなかったので記録もしない（テスト済みに見えるほうが危ない）。
      return {
        newsletter: newsletter.toProps(),
        sent: false,
        reason: outcome.reason,
        delivered: 0,
        failed: 0,
        recipients: recipientEmails,
        locales,
      };
    }

    const tested = newsletter.withTestSent();
    await this.repository.save(tested);

    return {
      newsletter: tested.toProps(),
      sent: true,
      delivered: outcome.delivered,
      failed: outcome.failures.length,
      recipients: recipientEmails,
      locales,
    };
  }
}
