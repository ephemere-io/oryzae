import type { SupabaseClient } from '@supabase/supabase-js';
import type { BoardSnippetRepositoryGateway } from '../../domain/gateways/board-snippet-repository.gateway.js';
import { BoardSnippet } from '../../domain/models/board-snippet.js';

export class SupabaseBoardSnippetRepository implements BoardSnippetRepositoryGateway {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string): Promise<BoardSnippet | null> {
    const { data, error } = await this.supabase
      .from('board_snippets')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.toDomain(data);
  }

  async findByIds(ids: string[]): Promise<BoardSnippet[]> {
    if (ids.length === 0) return [];

    const { data, error } = await this.supabase.from('board_snippets').select('*').in('id', ids);

    if (error) throw error;
    return (data ?? []).map((row: Record<string, unknown>) => this.toDomain(row));
  }

  async save(snippet: BoardSnippet): Promise<void> {
    const props = snippet.toProps();
    const { error } = await this.supabase.from('board_snippets').insert({
      id: props.id,
      user_id: props.userId,
      text: props.text,
      created_at: props.createdAt,
      updated_at: props.updatedAt,
    });
    if (error) throw error;
  }

  async update(snippet: BoardSnippet): Promise<void> {
    const props = snippet.toProps();
    const { error } = await this.supabase
      .from('board_snippets')
      .update({
        text: props.text,
        updated_at: props.updatedAt,
      })
      .eq('id', props.id);
    if (error) throw error;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from('board_snippets').delete().eq('id', id);
    if (error) throw error;
  }

  // @type-assertion-allowed: Supabase row data is untyped Record<string, unknown>
  private toDomain(row: Record<string, unknown>): BoardSnippet {
    return BoardSnippet.fromProps({
      id: row.id as string,
      userId: row.user_id as string,
      text: row.text as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    });
  }
}
