import type { SupabaseClient } from '@supabase/supabase-js';
import { readEnum, readString } from '../../../shared/infrastructure/row.js';
import type {
  NewsletterTranslation,
  NewsletterTranslationRepositoryGateway,
} from '../../domain/gateways/newsletter-translation-repository.gateway.js';
import { TRANSLATABLE_LOCALES } from '../../domain/models/newsletter-locale.js';

export class SupabaseNewsletterTranslationRepository
  implements NewsletterTranslationRepositoryGateway
{
  constructor(private supabase: SupabaseClient) {}

  async listByNewsletterId(newsletterId: string): Promise<NewsletterTranslation[]> {
    const { data, error } = await this.supabase
      .from('newsletter_translations')
      .select('*')
      .eq('newsletter_id', newsletterId);

    if (error) throw error;
    return (data ?? []).map((row: Record<string, unknown>) => this.toDomain(row));
  }

  async save(newsletterId: string, translation: NewsletterTranslation): Promise<void> {
    const { error } = await this.supabase.from('newsletter_translations').upsert(
      {
        newsletter_id: newsletterId,
        locale: translation.locale,
        subject: translation.subject,
        body_markdown: translation.bodyMarkdown,
        source_subject: translation.sourceSubject,
        source_body_markdown: translation.sourceBodyMarkdown,
        updated_at: translation.updatedAt,
      },
      // 訳し直しは同じ (newsletter_id, locale) を上書きする。行を増やすと
      // 「どれが最新か」を後から決める必要が出る。
      { onConflict: 'newsletter_id,locale' },
    );

    if (error) throw error;
  }

  private toDomain(row: Record<string, unknown>): NewsletterTranslation {
    return {
      locale: readEnum(row, 'locale', TRANSLATABLE_LOCALES),
      subject: readString(row, 'subject'),
      bodyMarkdown: readString(row, 'body_markdown'),
      sourceSubject: readString(row, 'source_subject'),
      sourceBodyMarkdown: readString(row, 'source_body_markdown'),
      updatedAt: readString(row, 'updated_at'),
    };
  }
}
