/**
 * ocr_usage からコスト集計を作る（migration 00023）。
 *
 * 立て付けは fermentation-cost-query.ts と同じで、返すのは **推定値**
 * （記録済みトークン × claude-pricing.ts の価格表）。実請求額は cost_report が正。
 *
 * 発酵と分けてあるのは、単価が違うため（OCR は claude-opus-5 で $5/$25、発酵は
 * claude-sonnet-4-6 で $3/$15）。合算してから一律単価を掛けると金額が黙ってズレる。
 *
 * 単価は行ごとに model 列から引き直す。gateway のモデルを差し替えた前後の
 * レコードが混在しうるため、集計時点の定数で全行を計算してはいけない。
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { computeCostFromTokens, rateForModel } from './claude-pricing.js';
import { readNumber, readString } from './row.js';

/** Supabase の1リクエスト上限。これを超える分はページングで取り切る。 */
const PAGE_SIZE = 1000;
/** 暴走防止の上限（5万件）。超えたら truncated=true で呼び出し側に知らせる。 */
const MAX_PAGES = 50;

export interface OcrUsageRow {
  userId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  createdAt: string;
}

interface OcrUserAggregate {
  userId: string;
  requestCount: number;
  estimatedCostUsd: number;
  inputTokens: number;
  outputTokens: number;
}

interface OcrModelAggregate {
  model: string;
  requestCount: number;
  estimatedCostUsd: number;
  inputTokens: number;
  outputTokens: number;
  /** 価格表にこのモデルが無い場合 true（金額は 0 として扱われている）。 */
  unpriced: boolean;
}

export interface OcrCostAggregate {
  estimatedCostUsd: number;
  inputTokens: number;
  outputTokens: number;
  requestCount: number;
  /** 価格表に無いモデルで、金額を出せなかった件数。過少計上の度合いを示す。 */
  untrackedCount: number;
  /** 推定コスト降順。 */
  byUser: OcrUserAggregate[];
  /** どのモデルで幾らかかったか。単価の根拠を突き合わせるために出す。 */
  byModel: OcrModelAggregate[];
}

export interface FetchOcrRowsResult {
  rows: OcrUsageRow[];
  /** MAX_PAGES に達して打ち切った場合 true。集計が過少であることを意味する。 */
  truncated: boolean;
}

interface FetchOptions {
  startIso?: string;
  endIso?: string;
  userId?: string;
}

/**
 * 期間内の ocr_usage を **全件** 取得する。
 *
 * migration 00023 が未適用の環境ではテーブルが無く throw する。呼び出し側で捕まえて
 * 「取得失敗」として扱うこと。0 件（= $0）と区別できなくなるため握り潰さない。
 */
export async function fetchOcrUsageRows(
  supabase: SupabaseClient,
  options: FetchOptions = {},
): Promise<FetchOcrRowsResult> {
  const rows: OcrUsageRow[] = [];

  for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex++) {
    let query = supabase
      .from('ocr_usage')
      .select('user_id, model, input_tokens, output_tokens, created_at');
    if (options.userId) query = query.eq('user_id', options.userId);
    if (options.startIso) query = query.gte('created_at', options.startIso);
    if (options.endIso) query = query.lte('created_at', options.endIso);

    const offset = pageIndex * PAGE_SIZE;
    const { data, error } = await query
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);

    const batch = data ?? [];
    for (const row of batch) {
      // row.ts のリーダーで読む。欠損を 0/'' に丸めると、スキーマがずれた瞬間に
      // 「コストが全部 $0」や「model 空文字 = 未知のモデル」として静かに現れる。
      // ずれたら例外にして、どのカラムがどう違うのかを出す。
      rows.push({
        userId: readString(row, 'user_id'),
        model: readString(row, 'model'),
        inputTokens: readNumber(row, 'input_tokens'),
        outputTokens: readNumber(row, 'output_tokens'),
        createdAt: readString(row, 'created_at'),
      });
    }

    if (batch.length < PAGE_SIZE) return { rows, truncated: false };
  }

  return { rows, truncated: true };
}

/** 行の集合から OCR のコスト集計を作る。単価は行ごとに model から引く。 */
export function aggregateOcrCost(rows: OcrUsageRow[]): OcrCostAggregate {
  const perUser = new Map<string, OcrUserAggregate>();
  const perModel = new Map<string, OcrModelAggregate>();
  let estimatedCostUsd = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let untrackedCount = 0;

  for (const row of rows) {
    const rate = rateForModel(row.model);
    if (rate === null) untrackedCount++;

    // 価格表に無いモデルは金額 0。既定の単価で埋めると誤った金額が「正しい数字」として出る。
    const cost = rate ? computeCostFromTokens(row.inputTokens, row.outputTokens, rate) : null;
    const rowCost = cost?.totalCost ?? 0;

    estimatedCostUsd += rowCost;
    inputTokens += row.inputTokens;
    outputTokens += row.outputTokens;

    const user = perUser.get(row.userId) ?? {
      userId: row.userId,
      requestCount: 0,
      estimatedCostUsd: 0,
      inputTokens: 0,
      outputTokens: 0,
    };
    user.requestCount++;
    user.estimatedCostUsd += rowCost;
    user.inputTokens += row.inputTokens;
    user.outputTokens += row.outputTokens;
    perUser.set(row.userId, user);

    const model = perModel.get(row.model) ?? {
      model: row.model,
      requestCount: 0,
      estimatedCostUsd: 0,
      inputTokens: 0,
      outputTokens: 0,
      unpriced: false,
    };
    model.requestCount++;
    model.estimatedCostUsd += rowCost;
    model.inputTokens += row.inputTokens;
    model.outputTokens += row.outputTokens;
    // 初期化子ではなく行ごとに立てる。初期化子だと「そのモデル名で最初に見た行」の
    // 判定に固定される。
    if (rate === null) model.unpriced = true;
    perModel.set(row.model, model);
  }

  return {
    estimatedCostUsd,
    inputTokens,
    outputTokens,
    requestCount: rows.length,
    untrackedCount,
    byUser: Array.from(perUser.values()).sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd),
    byModel: Array.from(perModel.values()).sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd),
  };
}

export interface DailyOcrCostAggregate {
  date: string;
  estimatedCostUsd: number;
  inputTokens: number;
  outputTokens: number;
  requestCount: number;
}

/**
 * 日別に集計する。日付キーの作り方（JST / UTC）は呼び出し側が決める。
 * Anthropic の実額と並べるときは UTC、運用レポートは JST を渡すこと。
 */
export function aggregateOcrCostByDay(
  rows: OcrUsageRow[],
  toDateKey: (createdAt: string) => string,
): DailyOcrCostAggregate[] {
  const perDay = new Map<string, DailyOcrCostAggregate>();

  for (const row of rows) {
    const date = toDateKey(row.createdAt);
    const rate = rateForModel(row.model);
    const cost = rate ? computeCostFromTokens(row.inputTokens, row.outputTokens, rate) : null;
    const current = perDay.get(date) ?? {
      date,
      estimatedCostUsd: 0,
      inputTokens: 0,
      outputTokens: 0,
      requestCount: 0,
    };
    current.estimatedCostUsd += cost?.totalCost ?? 0;
    current.inputTokens += row.inputTokens;
    current.outputTokens += row.outputTokens;
    current.requestCount++;
    perDay.set(date, current);
  }

  return Array.from(perDay.values()).sort((a, b) => a.date.localeCompare(b.date));
}
