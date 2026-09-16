/**
 * 配信先の言語。
 *
 * `packages/shared` の `localeSchema` と同じ 4 つ。domain は `@oryzae/shared` を
 * import できない（dep-cruiser の `domain-no-shared-package`）ので値を持ち直す。
 * ずれると「UI では選べるのに配信では無視される言語」が生まれるため、
 * 一致はテストで固定してある。
 */
export type NewsletterLocale = 'ja' | 'en' | 'zh' | 'ko';

export const NEWSLETTER_LOCALES: readonly NewsletterLocale[] = ['ja', 'en', 'zh', 'ko'];

/**
 * 原文の言語。運営者は日本語で書く。
 *
 * これを変えるなら翻訳の向き（`TRANSLATABLE_LOCALES`）も一緒に変えること。
 */
export const NEWSLETTER_SOURCE_LOCALE: NewsletterLocale = 'ja';

/** 翻訳が要る言語。原文の言語は含まない。 */
export type TranslatableLocale = Exclude<NewsletterLocale, 'ja'>;

export const TRANSLATABLE_LOCALES: readonly TranslatableLocale[] = ['en', 'zh', 'ko'];

export function isTranslatableLocale(locale: NewsletterLocale): locale is TranslatableLocale {
  return locale !== NEWSLETTER_SOURCE_LOCALE;
}

/**
 * `user_metadata.locale` の値を配信先の言語に解決する。
 *
 * **未設定・想定外の値は原文の言語（日本語）に倒す。**
 *
 * 英語に倒す案もあるが、それは「日本語話者が言語を設定していない」場合に、
 * これまで日本語で届いていた人へ急に英語を送ることになる。判別できないときは
 * 翻訳を挟まない＝運営者が書いたものをそのまま届けるほうが、外れ方が小さい。
 */
export function resolveNewsletterLocale(raw: unknown): NewsletterLocale {
  for (const locale of NEWSLETTER_LOCALES) {
    if (raw === locale) return locale;
  }
  return NEWSLETTER_SOURCE_LOCALE;
}
