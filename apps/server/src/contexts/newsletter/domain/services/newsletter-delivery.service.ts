import type { NewsletterTranslation } from '../gateways/newsletter-translation-repository.gateway.js';
import {
  isTranslatableLocale,
  NEWSLETTER_LOCALES,
  NEWSLETTER_SOURCE_LOCALE,
  type NewsletterLocale,
  type TranslatableLocale,
} from '../models/newsletter-locale.js';

/** その言語で実際に送る件名と本文。 */
export interface LocalizedContent {
  locale: NewsletterLocale;
  subject: string;
  bodyMarkdown: string;
}

interface SourceContent {
  subject: string;
  bodyMarkdown: string;
}

/**
 * 翻訳が「いまの原文」から作られているか。
 *
 * 原文を書き換えたあとの翻訳は、内容としては存在するが **配信に使ってはいけない**。
 * 日本語だけ直った配信が、他言語には古い文面で届くため。
 */
export function isTranslationFresh(
  translation: NewsletterTranslation,
  source: SourceContent,
): boolean {
  return (
    translation.sourceSubject === source.subject &&
    translation.sourceBodyMarkdown === source.bodyMarkdown
  );
}

/**
 * その言語で送る内容を決める。
 *
 * - 原文の言語（日本語）は翻訳を見ない
 * - 翻訳が無い / 古い言語は `null`。**原文にフォールバックしない**
 *
 * フォールバックすると「英語のつもりが日本語で届いた」が黙って起きる。
 * 送る前に気づけるよう、決められないことをそのまま返す。
 */
export function resolveLocalizedContent(
  locale: NewsletterLocale,
  source: SourceContent,
  translations: NewsletterTranslation[],
): LocalizedContent | null {
  if (locale === NEWSLETTER_SOURCE_LOCALE) {
    return { locale, subject: source.subject, bodyMarkdown: source.bodyMarkdown };
  }

  const translation = translations.find((t) => t.locale === locale);
  if (!translation || !isTranslationFresh(translation, source)) return null;

  return {
    locale,
    subject: translation.subject,
    bodyMarkdown: translation.bodyMarkdown,
  };
}

/**
 * 宛先がいる言語のうち、翻訳が揃っていないものを返す。
 *
 * **宛先が 0 名の言語は無視する。** 韓国語の登録者が 1 人もいないのに韓国語の
 * 翻訳を要求すると、使われない翻訳に LLM の費用を払い続けることになる。
 */
export function missingTranslationLocales(
  recipientCountByLocale: Record<NewsletterLocale, number>,
  source: SourceContent,
  translations: NewsletterTranslation[],
): TranslatableLocale[] {
  const missing: TranslatableLocale[] = [];

  // Object.entries ではなく既知の言語を回す（キーを string から戻すキャストが要らない）。
  for (const locale of NEWSLETTER_LOCALES) {
    if (recipientCountByLocale[locale] === 0) continue;
    if (!isTranslatableLocale(locale)) continue;
    if (resolveLocalizedContent(locale, source, translations) === null) missing.push(locale);
  }

  return missing;
}
