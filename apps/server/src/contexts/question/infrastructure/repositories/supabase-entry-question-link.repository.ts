import type { SupabaseClient } from '@supabase/supabase-js';
import type { EntryQuestionLinkRepositoryGateway } from '../../domain/gateways/entry-question-link-repository.gateway.js';

export class SupabaseEntryQuestionLinkRepository implements EntryQuestionLinkRepositoryGateway {
  constructor(private supabase: SupabaseClient) {}

  async link(entryId: string, questionId: string): Promise<void> {
    const { error } = await this.supabase
      .from('entry_question_links')
      .upsert(
        { entry_id: entryId, question_id: questionId },
        { onConflict: 'entry_id,question_id' },
      );
    if (error) throw error;
  }

  async unlink(entryId: string, questionId: string): Promise<void> {
    const { error } = await this.supabase
      .from('entry_question_links')
      .delete()
      .eq('entry_id', entryId)
      .eq('question_id', questionId);
    if (error) throw error;
  }

  async listQuestionIdsByEntryId(entryId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('entry_question_links')
      .select('question_id')
      .eq('entry_id', entryId);

    if (error) throw error;
    return (data ?? []).map(
      (row: Record<string, unknown>) => (row as Record<string, unknown>).question_id as string,
    );
  }
}
