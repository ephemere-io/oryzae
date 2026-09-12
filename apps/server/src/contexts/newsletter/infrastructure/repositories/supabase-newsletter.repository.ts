import type { SupabaseClient } from '@supabase/supabase-js';
import {
  readEnum,
  readNumber,
  readString,
  readStringOrNull,
} from '../../../shared/infrastructure/row.js';
import type { NewsletterRepositoryGateway } from '../../domain/gateways/newsletter-repository.gateway.js';
import { NEWSLETTER_STATUSES, Newsletter } from '../../domain/models/newsletter.js';

export class SupabaseNewsletterRepository implements NewsletterRepositoryGateway {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string): Promise<Newsletter | null> {
    const { data, error } = await this.supabase
      .from('newsletters')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return this.toDomain(data);
  }

  async listRecent(limit: number): Promise<Newsletter[]> {
    const { data, error } = await this.supabase
      .from('newsletters')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []).map((row: Record<string, unknown>) => this.toDomain(row));
  }

  async findLastSent(): Promise<Newsletter | null> {
    const { data, error } = await this.supabase
      .from('newsletters')
      .select('*')
      .eq('status', 'sent')
      .not('sent_at', 'is', null)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return this.toDomain(data);
  }

  async save(newsletter: Newsletter): Promise<void> {
    const props = newsletter.toProps();
    const { error } = await this.supabase.from('newsletters').upsert({
      id: props.id,
      subject: props.subject,
      body_markdown: props.bodyMarkdown,
      status: props.status,
      created_by: props.createdBy,
      recipient_count: props.recipientCount,
      sent_count: props.sentCount,
      failed_count: props.failedCount,
      last_error: props.lastError,
      sent_at: props.sentAt,
      created_at: props.createdAt,
      updated_at: props.updatedAt,
    });

    if (error) throw error;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from('newsletters').delete().eq('id', id);
    if (error) throw error;
  }

  private toDomain(row: Record<string, unknown>): Newsletter {
    return Newsletter.fromProps({
      id: readString(row, 'id'),
      subject: readString(row, 'subject'),
      bodyMarkdown: readString(row, 'body_markdown'),
      status: readEnum(row, 'status', NEWSLETTER_STATUSES),
      createdBy: readStringOrNull(row, 'created_by'),
      recipientCount: readNumber(row, 'recipient_count'),
      sentCount: readNumber(row, 'sent_count'),
      failedCount: readNumber(row, 'failed_count'),
      lastError: readStringOrNull(row, 'last_error'),
      sentAt: readStringOrNull(row, 'sent_at'),
      createdAt: readString(row, 'created_at'),
      updatedAt: readString(row, 'updated_at'),
    });
  }
}
