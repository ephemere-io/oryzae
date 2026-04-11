import type { SupabaseClient } from '@supabase/supabase-js';
import type { BoardPhotoRepositoryGateway } from '../../domain/gateways/board-photo-repository.gateway.js';
import { BoardPhoto } from '../../domain/models/board-photo.js';

export class SupabaseBoardPhotoRepository implements BoardPhotoRepositoryGateway {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string): Promise<BoardPhoto | null> {
    const { data, error } = await this.supabase
      .from('board_photos')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.toDomain(data);
  }

  async findByIds(ids: string[]): Promise<BoardPhoto[]> {
    if (ids.length === 0) return [];
    const { data, error } = await this.supabase.from('board_photos').select('*').in('id', ids);
    if (error) throw error;
    return (data ?? []).map((row: Record<string, unknown>) => this.toDomain(row));
  }

  async save(photo: BoardPhoto): Promise<void> {
    const props = photo.toProps();
    const { error } = await this.supabase.from('board_photos').insert({
      id: props.id,
      user_id: props.userId,
      storage_path: props.storagePath,
      caption: props.caption,
      created_at: props.createdAt,
      updated_at: props.updatedAt,
    });
    if (error) throw error;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from('board_photos').delete().eq('id', id);
    if (error) throw error;
  }

  // @type-assertion-allowed: Supabase row data is untyped Record<string, unknown>
  private toDomain(row: Record<string, unknown>): BoardPhoto {
    return BoardPhoto.fromProps({
      id: row.id as string,
      userId: row.user_id as string,
      storagePath: row.storage_path as string,
      caption: row.caption as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    });
  }
}
