import type { TranslatableLocale } from '../models/newsletter-locale.js';

export interface NewsletterTranslation {
  locale: TranslatableLocale;
  subject: string;
  bodyMarkdown: string;
  /**
   * 訳したときの原文。フラグではなく原文そのものを持つ。
   *
   * 「翻訳済み」だけを持つと、原文を書き換えたあとも翻訳済みに見えてしまい、
   * 日本語だけ直った配信が他言語には古い文面で届く。原文を控えておけば、
   * いまの本文と突き合わせるだけで古さが分かる（無効化の書き込みが要らない）。
   */
  sourceSubject: string;
  sourceBodyMarkdown: string;
  updatedAt: string;
}

export interface NewsletterTranslationRepositoryGateway {
  listByNewsletterId(newsletterId: string): Promise<NewsletterTranslation[]>;
  save(newsletterId: string, translation: NewsletterTranslation): Promise<void>;
}
