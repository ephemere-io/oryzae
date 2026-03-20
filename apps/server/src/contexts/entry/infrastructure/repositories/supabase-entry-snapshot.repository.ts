import type { SupabaseClient } from '@supabase/supabase-js';
import type { EntrySnapshotRepositoryGateway } from '../../domain/gateways/entry-snapshot-repository.gateway';
import type { EntrySnapshot } from '../../domain/models/entry-snapshot';

export class SupabaseEntrySnapshotRepository
  implements EntrySnapshotRepositoryGateway
{
  constructor(private supabase: SupabaseClient) {}

  async append(
    snapshot: Omit<EntrySnapshot, 'id' | 'createdAt'>,
  ): Promise<EntrySnapshot> {
    const { data, error } = await this.supabase
      .from('entry_snapshots')
      .insert({
        entry_id: snapshot.entryId,
        content: snapshot.content,
        editor_type: snapshot.editorType,
        editor_version: snapshot.editorVersion,
        extension: snapshot.extension,
      })
      .select()
      .single();

    if (error) throw error;
    return this.toDomain(data);
  }

  async findLatestByEntryId(
    entryId: string,
  ): Promise<EntrySnapshot | null> {
    const { data, error } = await this.supabase
      .from('entry_snapshots')
      .select('*')
      .eq('entry_id', entryId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return this.toDomain(data);
  }

  private toDomain(row: Record<string, unknown>): EntrySnapshot {
    return {
      id: row.id as string,
      entryId: row.entry_id as string,
      content: row.content as string,
      editorType: row.editor_type as string,
      editorVersion: row.editor_version as string,
      extension: (row.extension as Record<string, unknown>) ?? {},
      createdAt: row.created_at as string,
    };
  }
}
