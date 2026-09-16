import type { TranslatableLocale } from '../models/newsletter-locale.js';

export interface NewsletterTranslationRequest {
  /** 日本語の原文。 */
  subject: string;
  bodyMarkdown: string;
  targetLocale: TranslatableLocale;
}

export interface NewsletterTranslationResult {
  subject: string;
  bodyMarkdown: string;
}

export interface NewsletterTranslatorGateway {
  translate(request: NewsletterTranslationRequest): Promise<NewsletterTranslationResult>;
}
