import type { SupabaseClient } from '@supabase/supabase-js';
import type { AiFeature } from '../domain/gateways/ai-usage-recorder.gateway.js';
import { readEnum, readNumber, readString, readStringOrNull, toRecordArray } from './row.js';

/**
 * ai_usage（AI の機能を 1 回使うごとに 1 行）を読む。
 *
 * ここが返すのは回数とトークン数という事実だけ。金額は出さない——実請求額は
 * Workspace 別の cost_report が正で、ユーザー別の推定が要る所は呼び出し側で
 * トークン × 単価を掛ける。
 */

const PAGE_SIZE = 1000;
// 暴走防止。1000 行 × 20 = 2 万回/日を超えたら打ち切り、truncated で過少を伝える。
const MAX_PAGES = 20;
// .in() の id は URL に載る。uuid 36 文字 × 200 ≒ 7.5KB に収める。
const ID_CHUNK_SIZE = 200;

const FEATURES: readonly AiFeature[] = ['fermentation', 'ocr_board', 'ocr_entry'];

interface AiUsageRow {
  userId: string;
  feature: AiFeature;
  refId: string | null;
  inputTokens: number;
  outputTokens: number;
}

interface AiUsageUserAggregate {
  userId: string;
  count: number;
  inputTokens: number;
  outputTokens: number;
}

export interface AiUsageFeatureAggregate {
  count: number;
  inputTokens: number;
  outputTokens: number;
  /** 回数の多い順。 */
  byUser: AiUsageUserAggregate[];
}

/**
 * 「記録が 0 件」と「読めなかった」を区別する。migration 未適用で表が無いと
 * クエリは失敗する。それを 0 回と出すと、使われていないように読めてしまう。
 */
export type AiUsageResult =
  | {
      kind: 'ok';
      byFeature: Record<AiFeature, AiUsageFeatureAggregate>;
      /** 上限まで読んで打ち切った場合 true（= 回数は過少）。 */
      truncated: boolean;
    }
  | { kind: 'error'; message: string };

function toRow(record: Record<string, unknown>): AiUsageRow {
  return {
    userId: readString(record, 'user_id'),
    feature: readEnum(record, 'feature', FEATURES),
    refId: readStringOrNull(record, 'ref_id'),
    inputTokens: readNumber(record, 'input_tokens'),
    outputTokens: readNumber(record, 'output_tokens'),
  };
}

function emptyFeature(): AiUsageFeatureAggregate {
  return { count: 0, inputTokens: 0, outputTokens: 0, byUser: [] };
}

/** 行の集合を機能別・ユーザー別に集計する。使われなかった機能も 0 として持つ。 */
export function aggregateAiUsage(rows: AiUsageRow[]): Record<AiFeature, AiUsageFeatureAggregate> {
  const result: Record<AiFeature, AiUsageFeatureAggregate> = {
    fermentation: emptyFeature(),
    ocr_board: emptyFeature(),
    ocr_entry: emptyFeature(),
  };
  const users: Record<AiFeature, Map<string, AiUsageUserAggregate>> = {
    fermentation: new Map(),
    ocr_board: new Map(),
    ocr_entry: new Map(),
  };

  for (const row of rows) {
    const agg = result[row.feature];
    agg.count += 1;
    agg.inputTokens += row.inputTokens;
    agg.outputTokens += row.outputTokens;

    const user = users[row.feature].get(row.userId) ?? {
      userId: row.userId,
      count: 0,
      inputTokens: 0,
      outputTokens: 0,
    };
    user.count += 1;
    user.inputTokens += row.inputTokens;
    user.outputTokens += row.outputTokens;
    users[row.feature].set(row.userId, user);
  }

  for (const feature of FEATURES) {
    result[feature].byUser = Array.from(users[feature].values()).sort(
      (a, b) => b.count - a.count || b.inputTokens - a.inputTokens,
    );
  }
  return result;
}

/**
 * 期間内の記録を全件読んで集計する。service role のクライアントを渡すこと
 * （ユーザー向けの読み取りポリシーは無い）。
 */
export async function fetchAiUsage(
  supabase: SupabaseClient,
  /** utcDayRangeIso の戻り値。endIso は含む（発酵の集計と同じ窓）。 */
  range: { startIso: string; endIso: string },
): Promise<AiUsageResult> {
  const rows: AiUsageRow[] = [];
  try {
    for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex++) {
      const offset = pageIndex * PAGE_SIZE;
      const { data, error } = await supabase
        .from('ai_usage')
        .select('user_id, feature, ref_id, input_tokens, output_tokens')
        .gte('created_at', range.startIso)
        .lte('created_at', range.endIso)
        .order('created_at', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) return { kind: 'error', message: error.message };

      const batch = toRecordArray(data ?? [], 'ai_usage');
      for (const record of batch) rows.push(toRow(record));
      if (batch.length < PAGE_SIZE) {
        return { kind: 'ok', byFeature: aggregateAiUsage(rows), truncated: false };
      }
    }
    return { kind: 'ok', byFeature: aggregateAiUsage(rows), truncated: true };
  } catch (error) {
    return { kind: 'error', message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export interface TokenCount {
  inputTokens: number;
  outputTokens: number;
}

/**
 * 発酵ごとのトークン数（fermentation_results の id → その発酵で使った合計）。
 *
 * 再試行した発酵は 1 回ずつ別の行になっているので、ここで足し合わせる。
 * 記録が無い発酵（AI Gateway 時代・AI を呼ぶ前に失敗したもの）は Map に入らない。
 * 読めなかったときは例外にする（0 トークンと取り違えないため）。
 */
export async function fetchFermentationTokens(
  supabase: SupabaseClient,
  fermentationIds: readonly string[],
): Promise<Map<string, TokenCount>> {
  const totals = new Map<string, TokenCount>();
  for (let i = 0; i < fermentationIds.length; i += ID_CHUNK_SIZE) {
    const chunk = fermentationIds.slice(i, i + ID_CHUNK_SIZE);
    const { data, error } = await supabase
      .from('ai_usage')
      .select('user_id, feature, ref_id, input_tokens, output_tokens')
      .eq('feature', 'fermentation')
      .in('ref_id', chunk);
    if (error) throw new Error(`ai_usage select failed: ${error.message}`);

    for (const record of toRecordArray(data ?? [], 'ai_usage')) {
      const row = toRow(record);
      if (!row.refId) continue;
      const current = totals.get(row.refId) ?? { inputTokens: 0, outputTokens: 0 };
      current.inputTokens += row.inputTokens;
      current.outputTokens += row.outputTokens;
      totals.set(row.refId, current);
    }
  }
  return totals;
}
