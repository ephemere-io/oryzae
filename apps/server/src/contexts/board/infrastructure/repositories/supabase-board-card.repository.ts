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

export class SupabaseBoardCardRepository implements BoardCardRepositoryGateway {
  constructor(private supabase: SupabaseClient) {}

  async findByUserId(userId: string): Promise<BoardCard[]> {
    const { data, error } = await this.supabase
      .from('board_cards')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('z_index', { ascending: true });

    if (error) throw error;
    return toRecordArray(data ?? []).map((row) => this.toDomain(row));
  }

  /**
   * 種類ごとの枚数。1 つの付箋・写真は 1 行だけ（一意制約 `(user_id, ref_id)`）なので、
   * 行を数えれば壁に見えている枚数と一致する。運ぶのは短い文字列 1 つだけで、
   * 1 人ぶんの上限は実測で数十枚。
   */
  async countPinnedByType(userId: string): Promise<PinnedCounts> {
    const { data, error } = await this.supabase
      .from('board_cards')
      .select('card_type')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .neq('card_type', 'entry');

    if (error) throw error;

    const counts: PinnedCounts = { snippet: 0, photo: 0 };
    for (const row of toRecordArray(data ?? [])) {
      const cardType = readEnum(row, 'card_type', CARD_TYPES);
      if (cardType === 'snippet') counts.snippet += 1;
      if (cardType === 'photo') counts.photo += 1;
    }
    return counts;
  }

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

  async findMaxZIndex(userId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('board_cards')
      .select('z_index')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('z_index', { ascending: false })
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) return -1;
    return readNumber(toRecord(data[0]), 'z_index');
  }

  /**
   * 新しいカードを 1 枚貼る。
   *
   * 素の insert にしている。以前は週次の盤面を開くたびに日次からコピーを作っており、
   * 既にある行を黙って飛ばす upsert（ignoreDuplicates）だった。いま行を作るのは
   * 付箋・写真を新しく作ったときだけで ref は必ず新しいので、ぶつかったら黙らずに落とす。
   */
  async save(card: BoardCard): Promise<void> {
    const props = card.toProps();
    const { error } = await this.supabase.from('board_cards').insert({
      id: props.id,
      user_id: props.userId,
      card_type: props.cardType,
      ref_id: props.refId,
      x: props.x,
      y: props.y,
      rotation: props.rotation,
      width: props.width,
      height: props.height,
      z_index: props.zIndex,
      user_positioned: props.userPositioned,
      created_at: props.createdAt,
      updated_at: props.updatedAt,
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
    // Soft-delete: 剥がしただけ（中身は残す）
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
