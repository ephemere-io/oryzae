import type { SupabaseClient } from '@supabase/supabase-js';
import { readRecord, readString } from '../../../shared/infrastructure/row.js';
import type { EntrySnapshotRepositoryGateway } from '../../domain/gateways/entry-snapshot-repository.gateway.js';
import { EntrySnapshot } from '../../domain/models/entry-snapshot.js';

export class SupabaseEntrySnapshotRepository implements EntrySnapshotRepositoryGateway {
  constructor(private supabase: SupabaseClient) {}

  async append(snapshot: EntrySnapshot): Promise<void> {
    const props = snapshot.toProps();
    const { error } = await this.supabase.from('entry_snapshots').insert({
      id: props.id,
      entry_id: props.entryId,
      content: props.content,
      editor_type: props.editorType,
      editor_version: props.editorVersion,
      extension: props.extension,
      created_at: props.createdAt,
    });

    if (error) throw error;
  }

  async findLatestByEntryId(entryId: string): Promise<EntrySnapshot | null> {
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
    return EntrySnapshot.fromProps({
      id: readString(row, 'id'),
      entryId: readString(row, 'entry_id'),
      content: readString(row, 'content'),
      editorType: readString(row, 'editor_type'),
      editorVersion: readString(row, 'editor_version'),
      extension: readRecord(row, 'extension'),
      createdAt: readString(row, 'created_at'),
    });
  }
}
