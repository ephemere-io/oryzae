import type { SupabaseClient } from '@supabase/supabase-js';
import type { DeleteUserDataRepositoryGateway } from '../../domain/gateways/delete-user-data-repository.gateway.js';

/**
 * public.* で user_id を直接持つテーブル。FK は CASCADE 済みなので、
 * これらを消すと子テーブル (entry_snapshots, entry_question_links,
 * question_transactions, analysis_worksheets, etc.) も自動削除される。
 */
const USER_OWNED_TABLES = [
  'entries',
  'questions',
  'fermentation_results',
  'board_snippets',
  'board_cards',
  'board_photos',
  'profiles',
  'user_fermentation_state',
] as const;

/** auth.users に FK を持たない storage バケット。明示的に削除する */
const STORAGE_BUCKETS = ['avatars', 'board-photos'] as const;

export class SupabaseDeleteUserDataRepository implements DeleteUserDataRepositoryGateway {
  constructor(private supabase: SupabaseClient) {}

  async findAuthUserEmail(userId: string): Promise<string | null> {
    const { data, error } = await this.supabase.auth.admin.getUserById(userId);
    if (error || !data.user) return null;
    return data.user.email ?? '';
  }

  async deletePublicData(userId: string): Promise<void> {
    for (const table of USER_OWNED_TABLES) {
      const idColumn = table === 'profiles' ? 'id' : 'user_id';
      const { error } = await this.supabase.from(table).delete().eq(idColumn, userId);
      if (error) {
        throw new Error(`Failed to delete from ${table}: ${error.message}`);
      }
    }
  }

  async deleteStorageObjects(userId: string): Promise<void> {
    for (const bucket of STORAGE_BUCKETS) {
      const { data: files, error: listError } = await this.supabase.storage
        .from(bucket)
        .list(userId);
      if (listError) {
        // バケット自体が無い場合はスキップ。それ以外は致命的
        if (listError.message.toLowerCase().includes('not found')) continue;
        throw new Error(`Failed to list ${bucket}/${userId}: ${listError.message}`);
      }
      if (!files || files.length === 0) continue;

      const paths = files.map((f) => `${userId}/${f.name}`);
      const { error: removeError } = await this.supabase.storage.from(bucket).remove(paths);
      if (removeError) {
        throw new Error(`Failed to remove ${bucket} objects: ${removeError.message}`);
      }
    }
  }

  async deleteAuthUser(userId: string): Promise<void> {
    const { error } = await this.supabase.auth.admin.deleteUser(userId);
    if (error) {
      throw new Error(`Failed to delete auth user: ${error.message}`);
    }
  }
}
