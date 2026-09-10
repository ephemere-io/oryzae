import type { SupabaseClient } from '@supabase/supabase-js';
import {
  readEnum,
  readNumber,
  readString,
  toRecord,
  toRecordArray,
} from '../../../shared/infrastructure/row.js';
import type {
  BoardCardRepositoryGateway,
  CardPositionUpdate,
  PinnedCounts,
} from '../../domain/gateways/board-card-repository.gateway.js';
import { BoardCard } from '../../domain/models/board-card.js';

const CARD_TYPES = ['entry', 'snippet', 'photo'] as const;
const VIEW_TYPES = ['daily', 'weekly'] as const;

export class SupabaseBoardCardRepository implements BoardCardRepositoryGateway {
  constructor(private supabase: SupabaseClient) {}

  async findByDateAndView(userId: string, dateKey: string, viewType: string): Promise<BoardCard[]> {
    const { data, error } = await this.supabase
      .from('board_cards')
      .select('*')
      .eq('user_id', userId)
      .eq('date_key', dateKey)
      .eq('view_type', viewType)
      .eq('is_deleted', false)
      .order('z_index', { ascending: true });

    if (error) throw error;
    return toRecordArray(data ?? []).map((row) => this.toDomain(row));
  }

  /**
   * 全期間の枚数を種類ごとに。日付で絞らない（書斎の壁は総量を映す）。
   *
   * 件数だけを受け取る `head: true` ではなく `card_type` と `ref_id` を運ぶ。
   * **同じ付箋が daily と weekly の両方に居る**ことがあり、行を数えると壁に見えている
   * 枚数より多い数を名乗ってしまうため、ref で畳んでから数える（壁に描く側も
   * 同じ基準で畳んでいる）。運ぶのは短い文字列 2 つだけで、1 人ぶんの上限は
   * 実測で数十枚。
   */
  async countPinnedByType(userId: string): Promise<PinnedCounts> {
    const { data, error } = await this.supabase
      .from('board_cards')
      .select('card_type, ref_id')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .neq('card_type', 'entry');

    if (error) throw error;

    const seen = new Set<string>();
    const counts: PinnedCounts = { snippet: 0, photo: 0 };
    for (const row of toRecordArray(data ?? [])) {
      const cardType = readEnum(row, 'card_type', CARD_TYPES);
      const key = `${cardType}:${readString(row, 'ref_id')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (cardType === 'snippet') counts.snippet += 1;
      if (cardType === 'photo') counts.photo += 1;
    }
    return counts;
  }

  /**
   * 新しい順に上限まで。
   *
   * **weekly と daily の両方が返る。** 同じ付箋が両方に居ることがあり、書斎の壁では
   * 二重に見える。壁は「どのくらい貼ってあるか」を映す場所なので、ここでは畳まずに
   * 返し、重なりの扱いは呼び出し側（usecase）に任せる。
   */
  async findRecentByUserId(userId: string, limit: number): Promise<BoardCard[]> {
    const { data, error } = await this.supabase
      .from('board_cards')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .neq('card_type', 'entry')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return toRecordArray(data ?? []).map((row) => this.toDomain(row));
  }

  async findDailyCardsByDateRange(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<BoardCard[]> {
    const { data, error } = await this.supabase
      .from('board_cards')
      .select('*')
      .eq('user_id', userId)
      .eq('view_type', 'daily')
      .eq('is_deleted', false)
      .gte('date_key', startDate)
      .lte('date_key', endDate)
      .order('z_index', { ascending: true });

    if (error) throw error;
    return toRecordArray(data ?? []).map((row) => this.toDomain(row));
  }

  async findRefIdsByDateRange(
    userId: string,
    startDate: string,
    endDate: string,
    cardType: string,
  ): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('board_cards')
      .select('ref_id')
      .eq('user_id', userId)
      .eq('view_type', 'daily')
      .eq('card_type', cardType)
      .gte('date_key', startDate)
      .lte('date_key', endDate);

    if (error) throw error;
    return toRecordArray(data ?? []).map((row) => readString(row, 'ref_id'));
  }

  async findRefIdsByDateAndView(
    userId: string,
    dateKey: string,
    viewType: string,
    cardType: string,
  ): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('board_cards')
      .select('ref_id')
      .eq('user_id', userId)
      .eq('date_key', dateKey)
      .eq('view_type', viewType)
      .eq('card_type', cardType);

    if (error) throw error;
    return toRecordArray(data ?? []).map((row) => readString(row, 'ref_id'));
  }

  async findSoftDeletedRefIdsByDateAndView(
    userId: string,
    dateKey: string,
    viewType: string,
  ): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('board_cards')
      .select('ref_id')
      .eq('user_id', userId)
      .eq('date_key', dateKey)
      .eq('view_type', viewType)
      .eq('is_deleted', true);

    if (error) throw error;
    return toRecordArray(data ?? []).map((row) => readString(row, 'ref_id'));
  }

  async findMaxZIndex(userId: string, dateKey: string, viewType: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('board_cards')
      .select('z_index')
      .eq('user_id', userId)
      .eq('date_key', dateKey)
      .eq('view_type', viewType)
      .eq('is_deleted', false)
      .order('z_index', { ascending: false })
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) return -1;
    return readNumber(toRecord(data[0]), 'z_index');
  }

  async saveMany(cards: BoardCard[]): Promise<void> {
    if (cards.length === 0) return;

    const rows = cards.map((card) => {
      const props = card.toProps();
      return {
        id: props.id,
        user_id: props.userId,
        card_type: props.cardType,
        ref_id: props.refId,
        date_key: props.dateKey,
        view_type: props.viewType,
        x: props.x,
        y: props.y,
        rotation: props.rotation,
        width: props.width,
        height: props.height,
        z_index: props.zIndex,
        user_positioned: props.userPositioned,
        created_at: props.createdAt,
        updated_at: props.updatedAt,
      };
    });

    const { error } = await this.supabase.from('board_cards').upsert(rows, {
      onConflict: 'user_id,ref_id,date_key,view_type',
      ignoreDuplicates: true,
    });
    if (error) throw error;
  }

  async updatePositions(cards: CardPositionUpdate[]): Promise<void> {
    if (cards.length === 0) return;

    const now = new Date().toISOString();
    const promises = cards.map((card) =>
      this.supabase
        .from('board_cards')
        .update({
          x: card.x,
          y: card.y,
          rotation: card.rotation,
          width: card.width,
          height: card.height,
          z_index: card.zIndex,
          // 未指定（旧クライアント）のときは既存値を変えない。
          ...(card.userPositioned === undefined ? {} : { user_positioned: card.userPositioned }),
          updated_at: now,
        })
        .eq('id', card.id),
    );

    const results = await Promise.all(promises);
    for (const result of results) {
      if (result.error) throw result.error;
    }
  }

  async delete(id: string, userId: string): Promise<void> {
    // Soft-delete: mark as deleted so auto-populate doesn't re-create
    const { error } = await this.supabase
      .from('board_cards')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
  }

  async deleteByRefId(refId: string, userId: string): Promise<void> {
    // Hard-delete: used when underlying data (snippet/photo) is also deleted
    const { error } = await this.supabase
      .from('board_cards')
      .delete()
      .eq('ref_id', refId)
      .eq('user_id', userId);
    if (error) throw error;
  }

  private toDomain(row: Record<string, unknown>): BoardCard {
    return BoardCard.fromProps({
      id: readString(row, 'id'),
      userId: readString(row, 'user_id'),
      cardType: readEnum(row, 'card_type', CARD_TYPES),
      refId: readString(row, 'ref_id'),
      dateKey: readString(row, 'date_key'),
      viewType: readEnum(row, 'view_type', VIEW_TYPES),
      x: readNumber(row, 'x'),
      y: readNumber(row, 'y'),
      rotation: readNumber(row, 'rotation'),
      width: readNumber(row, 'width'),
      height: readNumber(row, 'height'),
      zIndex: readNumber(row, 'z_index'),
      // 列を足す前の行や、まだ移行していない環境では undefined になりうるので false に倒す。
      userPositioned: row.user_positioned === true,
      createdAt: readString(row, 'created_at'),
      updatedAt: readString(row, 'updated_at'),
    });
  }
}
