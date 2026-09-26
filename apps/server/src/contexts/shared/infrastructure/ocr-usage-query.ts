import type { SupabaseClient } from '@supabase/supabase-js';
import type { OcrUsageSource } from '../domain/gateways/ocr-usage-recorder.gateway.js';
import { readBoolean, readEnum, readNumberOrNull, readString, toRecordArray } from './row.js';

/**
 * ocr_usage_events（ボード OCR / 写真の文字起こしの呼び出し記録）を読んで、
 * 日次コストレポートの「誰が何回使ったか」を作る。
 *
 * 金額は出さない。実請求額は Workspace 別の cost_report が正で、OCR のモデルは
 * 価格表（claude-pricing.ts）に載せていない。ここで出すのは回数とトークン数という事実だけ。
 */

const PAGE_SIZE = 1000;
// 暴走防止。1000 行 × 20 = 2 万回/日を超えたら打ち切り、truncated で過少を伝える。
const MAX_PAGES = 20;

const SOURCES: readonly OcrUsageSource[] = ['board', 'entry'];

interface OcrUsageRow {
  userId: string;
  source: OcrUsageSource;
  inputTokens: number | null;
  outputTokens: number | null;
  succeeded: boolean;
}

interface OcrUsageUserAggregate {
  userId: string;
  count: number;
  inputTokens: number;
  outputTokens: number;
}

export interface OcrUsageSourceAggregate {
  count: number;
  succeededCount: number;
  failedCount: number;
  inputTokens: number;
  outputTokens: number;
  /** 回数の多い順。 */
  byUser: OcrUsageUserAggregate[];
}

/**
 * 「記録が 0 件」と「読めなかった」を区別する。migration 未適用でテーブルが無いと
 * クエリは失敗する。それを 0 回と出すと、使われていないように読めてしまう。
 */
export type OcrUsageResult =
  | {
      kind: 'ok';
      bySource: Record<OcrUsageSource, OcrUsageSourceAggregate>;
      /** 上限まで読んで打ち切った場合 true（= 回数は過少）。 */
      truncated: boolean;
    }
  | { kind: 'error'; message: string };

function toRow(record: Record<string, unknown>): OcrUsageRow {
  return {
    userId: readString(record, 'user_id'),
    source: readEnum(record, 'source', SOURCES),
    inputTokens: readNumberOrNull(record, 'input_tokens'),
    outputTokens: readNumberOrNull(record, 'output_tokens'),
    succeeded: readBoolean(record, 'succeeded'),
  };
}

function emptySource(): OcrUsageSourceAggregate {
  return {
    count: 0,
    succeededCount: 0,
    failedCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    byUser: [],
  };
}

/** 行の集合を機能別・ユーザー別に集計する。 */
export function aggregateOcrUsage(
  rows: OcrUsageRow[],
): Record<OcrUsageSource, OcrUsageSourceAggregate> {
  const result: Record<OcrUsageSource, OcrUsageSourceAggregate> = {
    board: emptySource(),
    entry: emptySource(),
  };
  const users: Record<OcrUsageSource, Map<string, OcrUsageUserAggregate>> = {
    board: new Map(),
    entry: new Map(),
  };

  for (const row of rows) {
    const agg = result[row.source];
    const inTok = row.inputTokens ?? 0;
    const outTok = row.outputTokens ?? 0;
    agg.count += 1;
    if (row.succeeded) agg.succeededCount += 1;
    else agg.failedCount += 1;
    agg.inputTokens += inTok;
    agg.outputTokens += outTok;

    const user = users[row.source].get(row.userId) ?? {
      userId: row.userId,
      count: 0,
      inputTokens: 0,
      outputTokens: 0,
    };
    user.count += 1;
    user.inputTokens += inTok;
    user.outputTokens += outTok;
    users[row.source].set(row.userId, user);
  }

  for (const source of SOURCES) {
    result[source].byUser = Array.from(users[source].values()).sort(
      (a, b) => b.count - a.count || b.inputTokens - a.inputTokens,
    );
  }
  return result;
}

/**
 * 期間内の記録を全件読んで集計する。service role のクライアントを渡すこと
 * （ユーザー向けの読み取りポリシーは無い）。
 */
export async function fetchOcrUsage(
  supabase: SupabaseClient,
  /** utcDayRangeIso の戻り値。endIso は含む（発酵の集計と同じ窓）。 */
  range: { startIso: string; endIso: string },
): Promise<OcrUsageResult> {
  const rows: OcrUsageRow[] = [];
  try {
    for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex++) {
      const offset = pageIndex * PAGE_SIZE;
      const { data, error } = await supabase
        .from('ocr_usage_events')
        .select('user_id, source, input_tokens, output_tokens, succeeded')
        .gte('created_at', range.startIso)
        .lte('created_at', range.endIso)
        .order('created_at', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) return { kind: 'error', message: error.message };

      const batch = toRecordArray(data ?? [], 'ocr_usage_events');
      for (const record of batch) rows.push(toRow(record));
      if (batch.length < PAGE_SIZE) {
        return { kind: 'ok', bySource: aggregateOcrUsage(rows), truncated: false };
      }
    }
    return { kind: 'ok', bySource: aggregateOcrUsage(rows), truncated: true };
  } catch (error) {
    return { kind: 'error', message: error instanceof Error ? error.message : 'Unknown error' };
  }
}
