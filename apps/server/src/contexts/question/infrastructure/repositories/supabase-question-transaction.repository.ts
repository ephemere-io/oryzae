import type { SupabaseClient } from '@supabase/supabase-js';
import { readBoolean, readNumber, readString } from '../../../shared/infrastructure/row.js';
import type { QuestionTransactionRepositoryGateway } from '../../domain/gateways/question-transaction-repository.gateway.js';
import { QuestionTransaction } from '../../domain/models/question-transaction.js';

export class SupabaseQuestionTransactionRepository implements QuestionTransactionRepositoryGateway {
  constructor(private supabase: SupabaseClient) {}

  async listByQuestionId(questionId: string): Promise<QuestionTransaction[]> {
    const { data, error } = await this.supabase
      .from('question_transactions')
      .select('*')
      .eq('question_id', questionId)
      .order('question_version', { ascending: true });

    if (error) throw error;
    return (data ?? []).map((row: Record<string, unknown>) => this.toDomain(row));
  }

  async findLatestByQuestionId(questionId: string): Promise<QuestionTransaction | null> {
    const { data, error } = await this.supabase
      .from('question_transactions')
      .select('*')
      .eq('question_id', questionId)
      .order('question_version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return this.toDomain(data);
  }

  async findLatestValidatedByQuestionId(questionId: string): Promise<QuestionTransaction | null> {
    const { data, error } = await this.supabase
      .from('question_transactions')
      .select('*')
      .eq('question_id', questionId)
      .eq('is_validated_by_user', true)
      .order('question_version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return this.toDomain(data);
  }

  async findLatestValidatedByQuestionIds(
    questionIds: string[],
  ): Promise<Map<string, QuestionTransaction>> {
    const result = new Map<string, QuestionTransaction>();
    if (questionIds.length === 0) return result;

    const { data, error } = await this.supabase
      .from('question_transactions')
      .select('*')
      .in('question_id', questionIds)
      .eq('is_validated_by_user', true)
      .order('question_version', { ascending: false });

    if (error) throw error;

    // question_version 降順で並んでいるため、各 question_id について最初に現れた行が最新。
    for (const row of data ?? []) {
      const tx = this.toDomain(row);
      const questionId = tx.toProps().questionId;
      if (!result.has(questionId)) result.set(questionId, tx);
    }
    return result;
  }

  async findLatestUnvalidatedByQuestionId(questionId: string): Promise<QuestionTransaction | null> {
    const { data, error } = await this.supabase
      .from('question_transactions')
      .select('*')
      .eq('question_id', questionId)
      .eq('is_validated_by_user', false)
      .order('question_version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return this.toDomain(data);
  }

  async append(transaction: QuestionTransaction): Promise<void> {
    const props = transaction.toProps();
    const { error } = await this.supabase.from('question_transactions').insert({
      id: props.id,
      question_id: props.questionId,
      string: props.string,
      question_version: props.questionVersion,
      is_validated_by_user: props.isValidatedByUser,
      is_proposed_by_oryzae: props.isProposedByOryzae,
      created_at: props.createdAt,
      updated_at: props.updatedAt,
    });

    if (error) throw error;
  }

  async save(transaction: QuestionTransaction): Promise<void> {
    const props = transaction.toProps();
    const { error } = await this.supabase.from('question_transactions').upsert({
      id: props.id,
      question_id: props.questionId,
      string: props.string,
      question_version: props.questionVersion,
      is_validated_by_user: props.isValidatedByUser,
      is_proposed_by_oryzae: props.isProposedByOryzae,
      created_at: props.createdAt,
      updated_at: props.updatedAt,
    });

    if (error) throw error;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from('question_transactions').delete().eq('id', id);
    if (error) throw error;
  }

  private toDomain(row: Record<string, unknown>): QuestionTransaction {
    return QuestionTransaction.fromProps({
      id: readString(row, 'id'),
      questionId: readString(row, 'question_id'),
      string: readString(row, 'string'),
      questionVersion: readNumber(row, 'question_version'),
      isValidatedByUser: readBoolean(row, 'is_validated_by_user'),
      isProposedByOryzae: readBoolean(row, 'is_proposed_by_oryzae'),
      createdAt: readString(row, 'created_at'),
      updatedAt: readString(row, 'updated_at'),
    });
  }
}
