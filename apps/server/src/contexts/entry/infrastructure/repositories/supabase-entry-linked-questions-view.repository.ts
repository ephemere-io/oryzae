import type { SupabaseClient } from '@supabase/supabase-js';
import { readString, toRecordArray } from '../../../shared/infrastructure/row.js';
import type {
  EntryLinkedQuestionsViewRepositoryGateway,
  LinkedQuestionView,
} from '../../domain/gateways/entry-linked-questions-view-repository.gateway.js';

/**
 * Issue #323: 一覧画面で各エントリに紐づく問いを表示するための view 実装。
 *
 * `entry-context-isolation` を守るため question コンテキストの repository を
 * 経由せず、直接 Supabase に問い合わせる。
 *
 * 2 クエリ構成:
 *  1. entry_question_links から (entry_id, question_id) ペアを取得
 *  2. question_transactions から該当 question_id 群の validated 行を一括取得
 *     し、JS 側で question_version 最大のものに絞り込む
 *
 * PostgREST は直接 FK のみ embed できる (entry_question_links → questions は
 * 直接、entry_question_links → question_transactions は不可) ため、ネスト
 * embed ではなく 2 段クエリに分けて確実性を取る。
 *
 * RLS 設計上、entry_question_links は呼び出し側 (user-scoped supabase クライ
 * アント) に紐づく entry の行しか返さないので、user_id チェックは不要。
 */
export class SupabaseEntryLinkedQuestionsViewRepository
  implements EntryLinkedQuestionsViewRepositoryGateway
{
  constructor(private supabase: SupabaseClient) {}

  async listByEntryIds(entryIds: string[]): Promise<Record<string, LinkedQuestionView[]>> {
    if (entryIds.length === 0) return {};

    // 1) link 行
    const { data: linkRows, error: linkErr } = await this.supabase
      .from('entry_question_links')
      .select('entry_id, question_id')
      .in('entry_id', entryIds);
    if (linkErr) throw linkErr;
    const links = toRecordArray(linkRows ?? []);
    if (links.length === 0) return {};

    // 2) 関連する全 question_id の validated transaction を取得
    const questionIds = Array.from(new Set(links.map((r) => readString(r, 'question_id'))));
    const { data: txRows, error: txErr } = await this.supabase
      .from('question_transactions')
      .select('question_id, string, question_version')
      .in('question_id', questionIds)
      .eq('is_validated_by_user', true)
      .order('question_version', { ascending: false });
    if (txErr) throw txErr;

    // question_id → 最新 validated 文字列。order desc なので最初に出てきたもの
    // が version max。
    const latestTextByQuestion = new Map<string, string>();
    for (const row of toRecordArray(txRows ?? [])) {
      const qId = readString(row, 'question_id');
      if (latestTextByQuestion.has(qId)) continue;
      latestTextByQuestion.set(qId, readString(row, 'string'));
    }

    const result: Record<string, LinkedQuestionView[]> = {};
    for (const row of links) {
      const entryId = readString(row, 'entry_id');
      const questionId = readString(row, 'question_id');
      const bucket = result[entryId] ?? [];
      bucket.push({ id: questionId, currentText: latestTextByQuestion.get(questionId) ?? null });
      result[entryId] = bucket;
    }
    return result;
  }
}
