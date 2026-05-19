import { type EditorEffectsState, editorEffectsStateSchema } from '@oryzae/shared';
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

  async listByUserId(
    userId: string,
    cursor?: string,
    limit = 20,
    questionId?: string,
  ): Promise<Entry[]> {
    // Issue #331: 問いで絞り込む場合は先に entry_question_links から
    // 対象 entry_id 一覧を引いて IN フィルタにかける (PostgREST inner-join より
    // 結果の安定性を優先した二段クエリ。view repository と同じ判断)。
    if (questionId !== undefined) {
      const entryIds = await this.fetchEntryIdsByQuestion(questionId);
      if (entryIds.length === 0) return [];
      let query = this.supabase
        .from('entries')
        .select('*')
        .eq('user_id', userId)
        .in('id', entryIds)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (cursor) query = query.lt('created_at', cursor);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => this.toDomain(row));
    }

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

  async listFermentationEnabledByUserIdAndDate(userId: string, dateKey: string): Promise<Entry[]> {
    const startOfDay = `${dateKey}T00:00:00.000Z`;
    const nextDay = new Date(`${dateKey}T00:00:00.000Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const endOfDay = nextDay.toISOString();

    const { data, error } = await this.supabase
      .from('entries')
      .select('*')
      .eq('user_id', userId)
      .eq('fermentation_enabled', true)
      .gte('created_at', startOfDay)
      .lt('created_at', endOfDay)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map((row: Record<string, unknown>) => this.toDomain(row));
  }

  async listFermentationEnabledByUserIdSince(
    userId: string,
    sinceIso: string | null,
  ): Promise<Entry[]> {
    let query = this.supabase
      .from('entries')
      .select('*')
      .eq('user_id', userId)
      .eq('fermentation_enabled', true)
      .order('created_at', { ascending: true });

    if (sinceIso) {
      query = query.gt('created_at', sinceIso);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row: Record<string, unknown>) => this.toDomain(row));
  }

  async countCharsByUserIdSince(userId: string, sinceIso: string | null): Promise<number> {
    let query = this.supabase.from('entries').select('content').eq('user_id', userId);
    if (sinceIso) query = query.gt('created_at', sinceIso);
    const { data, error } = await query;
    if (error) throw error;
    // grapheme ではなくコードポイント単位でカウントする (日本語1000字/英語500字の閾値は
    // どちらも「文字」=コードポイント解釈で issue 仕様に十分近い)。サロゲートペアは
    // [...str].length で正しく1扱いされる。
    return (data ?? []).reduce(
      (sum, row: { content: string | null }) => sum + (row.content ? [...row.content].length : 0),
      0,
    );
  }

  async listByUserIdAndWeek(userId: string, dateKey: string): Promise<Entry[]> {
    // Calculate Monday of the week containing dateKey
    const d = new Date(`${dateKey}T00:00:00.000Z`);
    const day = d.getUTCDay();
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
    const nextMonday = new Date(monday);
    nextMonday.setUTCDate(monday.getUTCDate() + 7);

    const { data, error } = await this.supabase
      .from('entries')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', monday.toISOString())
      .lt('created_at', nextMonday.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map((row: Record<string, unknown>) => this.toDomain(row));
  }

  async searchByUserId(
    userId: string,
    query: string,
    cursor?: string,
    limit = 20,
    questionId?: string,
  ): Promise<Entry[]> {
    // Issue #331: 問い絞り込みと検索の同時利用
    let entryIdsFilter: string[] | undefined;
    if (questionId !== undefined) {
      entryIdsFilter = await this.fetchEntryIdsByQuestion(questionId);
      if (entryIdsFilter.length === 0) return [];
    }

    let q = this.supabase
      .from('entries')
      .select('*')
      .eq('user_id', userId)
      .ilike('content', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (entryIdsFilter) q = q.in('id', entryIdsFilter);
    if (cursor) {
      q = q.lt('created_at', cursor);
    }

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((row: Record<string, unknown>) => this.toDomain(row));
  }

  private async fetchEntryIdsByQuestion(questionId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('entry_question_links')
      .select('entry_id')
      .eq('question_id', questionId);
    if (error) throw error;
    return ((data ?? []) as Array<{ entry_id: string }>).map((r) => r.entry_id);
  }

  async save(entry: Entry): Promise<void> {
    const props = entry.toProps();
    const { error } = await this.supabase.from('entries').upsert({
      id: props.id,
      user_id: props.userId,
      content: props.content,
      media_urls: props.mediaUrls,
      fermentation_enabled: props.fermentationEnabled,
      effects: props.effects ?? {},
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
      fermentationEnabled: (row.fermentation_enabled as boolean) ?? false,
      effects: parseEffects(row.effects),
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    });
  }
}

// Parse the `effects` JSONB column. Older rows have `{}` (default), which we
// treat as "no effects" (null). Unknown shapes are also coerced to null so a
// malformed row doesn't break entry reads.
function parseEffects(raw: unknown): EditorEffectsState | null {
  if (!raw || typeof raw !== 'object') return null;
  if (Object.keys(raw as object).length === 0) return null;
  const parsed = editorEffectsStateSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
