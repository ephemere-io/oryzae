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
  MonthlyEntryCount,
} from '../../domain/gateways/entry-repository.gateway.js';
import { Entry } from '../../domain/models/entry.js';
import {
  localDayRange,
  localMonthKey,
  localWeekRange,
} from '../../domain/services/local-day-range.service.js';

/** PostgREST の 1 レスポンス上限。これを超えると黙って打ち切られる。 */
const MONTHLY_COUNT_PAGE_SIZE = 1000;

/** 辿るページ数の上限。1000 行 × 100 = 10 万件。到達したら黙って返さず投げる。 */
const MONTHLY_COUNT_MAX_PAGES = 100;

/** 月の集計を新しい月から並べる。`YYYY-MM` は辞書順＝時系列順。 */
function toSortedMonthlyCounts(counts: Map<string, number>): MonthlyEntryCount[] {
  return [...counts]
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : 0));
}

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

  async countByMonth(userId: string, tzOffsetMinutes = 0): Promise<MonthlyEntryCount[]> {
    const counts = new Map<string, number>();
    let cursor: string | null = null;

    // `.range()` / `.limit()` 無しで投げると PostgREST 既定の 1000 行で**黙って**打ち切られ、
    // 古い月ほど件数が少なく見える（エラーにならないので気づけない）。全件読み切る。
    //
    // ページングは offset ではなく **id のカーソル**で進める。id は gen_random_uuid() で
    // 時系列に並ばないため、offset だと読んでいる最中の INSERT が既読ページより前に入り込み、
    // 以降の行がずれて重複・取りこぼしになる（user-me.ts の selectAllRows と同じ判断）。
    for (let page = 0; page < MONTHLY_COUNT_MAX_PAGES; page++) {
      const rows = await this.fetchMonthlyCountPage(userId, cursor);

      let lastId: string | null = null;
      for (const row of rows) {
        const id = row.id;
        if (typeof id === 'string') lastId = id;
        const createdAt = row.created_at;
        if (typeof createdAt !== 'string') continue;
        const month = localMonthKey(createdAt, tzOffsetMinutes);
        // 壊れた 1 行で月別集計そのものを失わせない。その行だけ数えずに進む。
        if (month === null) continue;
        counts.set(month, (counts.get(month) ?? 0) + 1);
      }

      if (rows.length < MONTHLY_COUNT_PAGE_SIZE) {
        return toSortedMonthlyCounts(counts);
      }
      if (!lastId) {
        // カーソルを進められないと同じページを取り続ける。止めて気づけるようにする。
        throw new Error('entries: could not advance pagination cursor (missing id)');
      }
      cursor = lastId;
    }

    // 上限に達したら**投げる**。黙って部分結果を返すと、このページングが防ぐはずの
    // 「エラーにならないのに件数が少ない」状態を自分で作ってしまう。
    throw new Error(
      `entries: exceeded ${MONTHLY_COUNT_MAX_PAGES * MONTHLY_COUNT_PAGE_SIZE} rows; monthly counts would be incomplete`,
    );
  }

  /**
   * 月別集計の 1 ページ分（id と created_at だけ）。
   *
   * countByMonth から切り出しているのは型の都合。カーソルの型が「読んだ行から決まり、
   * 読む行はカーソルで決まる」循環になり、インライン化すると tsc が row を any に倒す
   * （TS7022）。戻り値の型を明示してその環を切る。
   */
  private async fetchMonthlyCountPage(
    userId: string,
    cursor: string | null,
  ): Promise<Record<string, unknown>[]> {
    const base = this.supabase.from('entries').select('id, created_at').eq('user_id', userId);
    const filtered = cursor ? base.gt('id', cursor) : base;

    const { data, error } = await filtered
      .order('id', { ascending: true })
      .limit(MONTHLY_COUNT_PAGE_SIZE);
    if (error) throw error;
    return toRecordArray(data ?? []);
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

  private async fetchEntryIdsByQuestion(questionId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('entry_question_links')
      .select('entry_id')
      .eq('question_id', questionId);
    if (error) throw error;
    return toRecordArray(data ?? []).map((r) => readString(r, 'entry_id'));
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
