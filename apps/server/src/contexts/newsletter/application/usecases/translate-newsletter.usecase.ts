import type { NewsletterAudienceGateway } from '../../domain/gateways/newsletter-audience.gateway.js';
import type { NewsletterRepositoryGateway } from '../../domain/gateways/newsletter-repository.gateway.js';
import type { NewsletterTranslationRepositoryGateway } from '../../domain/gateways/newsletter-translation-repository.gateway.js';
import type { NewsletterTranslatorGateway } from '../../domain/gateways/newsletter-translator.gateway.js';
import {
  isTranslatableLocale,
  NEWSLETTER_LOCALES,
  type NewsletterLocale,
  type TranslatableLocale,
} from '../../domain/models/newsletter-locale.js';
import { isTranslationFresh } from '../../domain/services/newsletter-delivery.service.js';
import { NewsletterNotFoundError, NewsletterValidationError } from '../errors/newsletter.errors.js';

export interface TranslateNewsletterResult {
  /** 今回訳した言語。 */
  translated: TranslatableLocale[];
  /** 既に最新だったので訳さなかった言語。 */
  skipped: TranslatableLocale[];
  /** 言語ごとの宛先数（画面の内訳表示に使う）。 */
  recipientCountByLocale: Record<NewsletterLocale, number>;
}

/**
 * 運営者が書いた日本語を、宛先がいる言語へ訳して保存する (issue #614 フォロー)。
 *
 * ## 誰のために訳すか
 *
 * **宛先が 1 人以上いる言語だけ。** 韓国語の登録者が 0 人なのに韓国語を訳すと、
 * 誰も読まない文章に LLM の費用を払い続けることになる。宛先は送信時に数え直す
 * ので、ここで訳していない言語に人が増えたら送信側のゲートが気づく。
 *
 * ## 訳し直しの判定
 *
 * 翻訳は「どの原文から訳したか」を持っている。原文が変わっていなければ訳し直さない
 * （同じ内容に二度払わない）。変わっていれば訳し直す。
 */
export class TranslateNewsletterUsecase {
  constructor(
    private repository: NewsletterRepositoryGateway,
    private translations: NewsletterTranslationRepositoryGateway,
    private audience: NewsletterAudienceGateway,
    private translator: NewsletterTranslatorGateway,
    private now: () => Date = () => new Date(),
  ) {}

  async execute(id: string): Promise<TranslateNewsletterResult> {
    const newsletter = await this.repository.findById(id);
    if (!newsletter) throw new NewsletterNotFoundError(id);

    // 送信済みの文面を訳し直しても、届いたメールは変わらない。
    if (newsletter.status !== 'draft') {
      throw new NewsletterValidationError('下書きのみ翻訳できます');
    }

    const source = { subject: newsletter.subject, bodyMarkdown: newsletter.bodyMarkdown };
    const recipientCountByLocale = await this.audience.countRecipientsByLocale();
    const existing = await this.translations.listByNewsletterId(id);

    const translated: TranslatableLocale[] = [];
    const skipped: TranslatableLocale[] = [];

    for (const locale of NEWSLETTER_LOCALES) {
      if (!isTranslatableLocale(locale)) continue;
      if (recipientCountByLocale[locale] === 0) continue;

      const current = existing.find((t) => t.locale === locale);
      if (current && isTranslationFresh(current, source)) {
        skipped.push(locale);
        continue;
      }

      const result = await this.translator.translate({
        subject: source.subject,
        bodyMarkdown: source.bodyMarkdown,
        targetLocale: locale,
      });

      await this.translations.save(id, {
        locale,
        subject: result.subject,
        bodyMarkdown: result.bodyMarkdown,
        // 訳した時点の原文を一緒に残す。これが無いと、あとから原文が変わったことに
        // 気づけず、古い翻訳のまま配信してしまう。
        sourceSubject: source.subject,
        sourceBodyMarkdown: source.bodyMarkdown,
        updatedAt: this.now().toISOString(),
      });
      translated.push(locale);
    }

    // 訳し直した＝届くものが変わったので、テスト配信の確認をやり直させる。
    // 日本語だけ見た状態で英訳を足し、そのまま送れると、英語話者に何が届くのか
    // 誰も見ていないまま配信することになる。
    if (translated.length > 0) {
      await this.repository.save(newsletter.withTestInvalidated());
    }

    return { translated, skipped, recipientCountByLocale };
  }
}
