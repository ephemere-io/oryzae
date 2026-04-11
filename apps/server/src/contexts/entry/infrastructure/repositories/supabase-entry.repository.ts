import type { SupabaseClient } from '@supabase/supabase-js';
import type { EntryRepositoryGateway } from '../../domain/gateways/entry-repository.gateway.js';
import { Entry } from '../../domain/models/entry.js';

export class SupabaseEntryRepository implements EntryRepositoryGateway {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string): Promise<Entry | null> {
    const { data, error } = await this.supabase.from('entries').select('*').eq('id', id).single();

    if (error || !data) return null;
    return this.toDomain(data);
  }

  async findByIds(ids: string[]): Promise<Entry[]> {
    if (ids.length === 0) return [];
    const { data, error } = await this.supabase.from('entries').select('*').in('id', ids);
    if (error) throw error;
    return (data ?? []).map((row: Record<string, unknown>) => this.toDomain(row));
  }

  async listByUserId(userId: string, cursor?: string, limit = 20): Promise<Entry[]> {
    let query = this.supabase
      .from('entries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row: Record<string, unknown>) => this.toDomain(row));
  }

  async listByUserIdAndDate(userId: string, dateKey: string): Promise<Entry[]> {
    const startOfDay = `${dateKey}T00:00:00.000Z`;
    const nextDay = new Date(`${dateKey}T00:00:00.000Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const endOfDay = nextDay.toISOString();

    const { data, error } = await this.supabase
      .from('entries')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startOfDay)
      .lt('created_at', endOfDay)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map((row: Record<string, unknown>) => this.toDomain(row));
  }

  async save(entry: Entry): Promise<void> {
    const props = entry.toProps();
    const { error } = await this.supabase.from('entries').upsert({
      id: props.id,
      user_id: props.userId,
      content: props.content,
      media_urls: props.mediaUrls,
      created_at: props.createdAt,
      updated_at: props.updatedAt,
    });
    if (error) throw error;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from('entries').delete().eq('id', id);
    if (error) throw error;
  }

  private toDomain(row: Record<string, unknown>): Entry {
    return Entry.fromProps({
      id: row.id as string,
      userId: row.user_id as string,
      content: row.content as string,
      mediaUrls: (row.media_urls as string[]) ?? [],
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    });
  }
}
