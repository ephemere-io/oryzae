import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  BoardCardRepositoryGateway,
  CardPositionUpdate,
} from '../../domain/gateways/board-card-repository.gateway.js';
import { BoardCard } from '../../domain/models/board-card.js';

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
    return (data ?? []).map((row: Record<string, unknown>) => this.toDomain(row));
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
    return (data ?? []).map((row: Record<string, unknown>) => this.toDomain(row));
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
    // @type-assertion-allowed: Supabase row data is untyped Record<string, unknown>
    return (data ?? []).map((row: Record<string, unknown>) => row.ref_id as string);
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
    // @type-assertion-allowed: Supabase row data is untyped Record<string, unknown>
    return (data ?? []).map((row: Record<string, unknown>) => row.ref_id as string);
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
    // @type-assertion-allowed: Supabase row data is untyped Record<string, unknown>
    return (data ?? []).map((row: Record<string, unknown>) => row.ref_id as string);
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
    return (data[0] as Record<string, unknown>).z_index as number;
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

  // @type-assertion-allowed: Supabase row data is untyped Record<string, unknown>
  private toDomain(row: Record<string, unknown>): BoardCard {
    return BoardCard.fromProps({
      id: row.id as string,
      userId: row.user_id as string,
      cardType: row.card_type as 'entry' | 'snippet' | 'photo',
      refId: row.ref_id as string,
      dateKey: row.date_key as string,
      viewType: row.view_type as 'daily' | 'weekly',
      x: row.x as number,
      y: row.y as number,
      rotation: row.rotation as number,
      width: row.width as number,
      height: row.height as number,
      zIndex: row.z_index as number,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    });
  }
}
