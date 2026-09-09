import { type EditorEffectsState, editorEffectsStateSchema } from '@oryzae/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  readBooleanOr,
  readString,
  readStringArray,
  toRecordArray,
} from '../../../shared/infrastructure/row.js';
import type {
  EntryListOrder,
  EntryRepositoryGateway,
} from '../../domain/gateways/entry-repository.gateway.js';
import { Entry } from '../../domain/models/entry.js';
import { localDayRange, localWeekRange } from '../../domain/services/local-day-range.service.js';

/** PostgREST の既定上限と同じ。これ以上を1回で頼んでも返ってこない。 */
const PAGE_SIZE = 1000;
/** `.in()` の ID は URL のクエリ文字列に載るので、1回あたりの個数を抑える。 */
const ID_CHUNK = 500;

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
    order: EntryListOrder = 'newest',
  ): Promise<Entry[]> {
    // created_at の並び順と、それに対応するカーソル比較（昇順=次は cursor より新しい→gt、
    // 降順=次は cursor より古い→lt）。cursor は最後に受け取った entry の created_at 値。
    const ascending = order === 'oldest';
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
        .order('created_at', { ascending })
        .limit(limit);
      if (cursor) {
        query = ascending ? query.gt('created_at', cursor) : query.lt('created_at', cursor);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => this.toDomain(row));
    }

    let query = this.supabase
      .from('entries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending })
      .limit(limit);

    if (cursor) {
      query = ascending ? query.gt('created_at', cursor) : query.lt('created_at', cursor);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row: Record<string, unknown>) => this.toDomain(row));
  }

  async listByUserIdAndDate(
    userId: string,
    dateKey: string,
    tzOffsetMinutes = 0,
  ): Promise<Entry[]> {
    const { startUtc: startOfDay, endUtc: endOfDay } = localDayRange(dateKey, tzOffsetMinutes);

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

  async countCharsByQuestionIdSince(
    userId: string,
    questionId: string,
    sinceIso: string | null,
  ): Promise<number> {
    // listByUserId と同じ二段クエリ (PostgREST の埋め込み join より結果が安定する)。
    // 対象は「その問いに紐づくエントリ」なので、まず link から entry_id を引く。
    //
    // **ここは件数を数える経路なので、暗黙の打ち切りが許されない。**
    // PostgREST は指定しないと既定 1000 行で黙って切る。過去に同じ形でユーザー別コストが
    // 静かに過少になった (#502)。readiness でこれをやると「書いたのに瓶が育たない」に化ける。
    const entryIds = await this.fetchAllEntryIdsByQuestion(questionId);
    if (entryIds.length === 0) return 0;

    // id リストは全部 URL のクエリ文字列に載るので、一度に投げず分割する
    // (1 チャンク = 最大 ID_CHUNK 行しか返らないので、内側での追加ページングは要らない)。
    let total = 0;
    for (let i = 0; i < entryIds.length; i += ID_CHUNK) {
      const chunk = entryIds.slice(i, i + ID_CHUNK);
      let query = this.supabase
        .from('entries')
        .select('content')
        .eq('user_id', userId)
        .in('id', chunk);
      if (sinceIso) query = query.gt('created_at', sinceIso);
      const { data, error } = await query;
      if (error) throw error;
      total += (data ?? []).reduce(
        (sum, row: { content: string | null }) => sum + (row.content ? [...row.content].length : 0),
        0,
      );
    }
    return total;
  }

  async listByUserIdAndWeek(
    userId: string,
    dateKey: string,
    tzOffsetMinutes = 0,
  ): Promise<Entry[]> {
    const { startUtc, endUtc } = localWeekRange(dateKey, tzOffsetMinutes);
    const monday = new Date(startUtc);
    const nextMonday = new Date(endUtc);

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
    order: EntryListOrder = 'newest',
  ): Promise<Entry[]> {
    const ascending = order === 'oldest';
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
      .order('created_at', { ascending })
      .limit(limit);

    if (entryIdsFilter) q = q.in('id', entryIdsFilter);
    if (cursor) {
      q = ascending ? q.gt('created_at', cursor) : q.lt('created_at', cursor);
    }

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((row: Record<string, unknown>) => this.toDomain(row));
  }

  /**
   * 一覧・検索が候補を絞るための entry_id。**PostgREST 既定の 1000 行で打ち切られる。**
   * 呼び出し側が別途 `.limit()` を掛ける表示経路なので許容している。
   * 数を合わせる必要がある経路では `fetchAllEntryIdsByQuestion` を使うこと。
   */
  private async fetchEntryIdsByQuestion(questionId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('entry_question_links')
      .select('entry_id')
      .eq('question_id', questionId);
    if (error) throw error;
    return toRecordArray(data ?? []).map((r) => readString(r, 'entry_id'));
  }

  /**
   * その問いに紐づく entry_id を **全件** 取る。1000 行を超えても落とさない。
   *
   * `.range()` でページングするので `.order()` が必須。順序を指定しないと Postgres が
   * ページ間で同じ並びを返す保証が無く、行の重複・取りこぼしが起きうる。
   */
  private async fetchAllEntryIdsByQuestion(questionId: string): Promise<string[]> {
    const ids: string[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await this.supabase
        .from('entry_question_links')
        .select('entry_id')
        .eq('question_id', questionId)
        .order('entry_id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      const rows = toRecordArray(data ?? []);
      ids.push(...rows.map((r) => readString(r, 'entry_id')));
      // 満杯でなければ最後のページ。次を引いても空なのでここで止める。
      if (rows.length < PAGE_SIZE) return ids;
    }
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
      id: readString(row, 'id'),
      userId: readString(row, 'user_id'),
      content: readString(row, 'content'),
      mediaUrls: readStringArray(row, 'media_urls'),
      fermentationEnabled: readBooleanOr(row, 'fermentation_enabled', false),
      effects: parseEffects(row.effects),
      createdAt: readString(row, 'created_at'),
      updatedAt: readString(row, 'updated_at'),
    });
  }
}

// Parse the `effects` JSONB column. Older rows have `{}` (default), which we
// treat as "no effects" (null). Unknown shapes are also coerced to null so a
// malformed row doesn't break entry reads.
function parseEffects(raw: unknown): EditorEffectsState | null {
  if (!raw || typeof raw !== 'object') return null;
  if (Object.keys(raw).length === 0) return null;
  const parsed = editorEffectsStateSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
