import type { SupabaseClient } from '@supabase/supabase-js';
import type { QuestionRepositoryGateway } from '../../domain/gateways/question-repository.gateway';
import { Question } from '../../domain/models/question';

export class SupabaseQuestionRepository implements QuestionRepositoryGateway {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string): Promise<Question | null> {
    const { data, error } = await this.supabase
      .from('questions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.toDomain(data);
  }

  async listActiveByUserId(userId: string): Promise<Question[]> {
    const { data, error } = await this.supabase
      .from('questions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_archived', false)
      .eq('is_validated_by_user', true)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data ?? []).map((row) => this.toDomain(row));
  }

  async listAllByUserId(userId: string): Promise<Question[]> {
    const { data, error } = await this.supabase
      .from('questions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map((row) => this.toDomain(row));
  }

  async listPendingByUserId(userId: string): Promise<Question[]> {
    const { data, error } = await this.supabase
      .from('questions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_validated_by_user', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map((row) => this.toDomain(row));
  }

  async countActiveByUserId(userId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_archived', false)
      .eq('is_validated_by_user', true);

    if (error) throw error;
    return count ?? 0;
  }

  async save(question: Question): Promise<void> {
    const props = question.toProps();
    const { error } = await this.supabase.from('questions').upsert({
      id: props.id,
      user_id: props.userId,
      is_archived: props.isArchived,
      is_validated_by_user: props.isValidatedByUser,
      is_proposed_by_oryzae: props.isProposedByOryzae,
      created_at: props.createdAt,
      updated_at: props.updatedAt,
    });
    if (error) throw error;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('questions')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  private toDomain(row: Record<string, unknown>): Question {
    return Question.fromProps({
      id: row.id as string,
      userId: row.user_id as string,
      isArchived: row.is_archived as boolean,
      isValidatedByUser: row.is_validated_by_user as boolean,
      isProposedByOryzae: row.is_proposed_by_oryzae as boolean,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    });
  }
}
