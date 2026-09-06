/**
 * fermentation_results からコスト集計を作る共通処理。
 *
 * ここが返すコストは **推定値** である（保存済みトークン × claude-pricing.ts の価格表）。
 * 実請求額は anthropic-cost-api.ts の cost_report が正。Anthropic 側は Oryzae の
 * ユーザーを知らないため、ユーザー別内訳だけはこの推定でしか出せない。
 * 表示・通知では必ず「推定」と明示すること。
 *
 * issue #352 以降 generation_id は発行されないので、フィルタは input_tokens 基準にする。
 * 旧 generation_id 方式のレコード（トークン未保存）は untrackedCount に計上して、
 * 「集計から漏れている件数」を隠さない。
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { computeCostFromTokens, FERMENTATION_MODEL_RATE } from './claude-pricing.js';

/** Supabase の1リクエスト上限。これを超える分はページングで取り切る。 */
const PAGE_SIZE = 1000;
/** 暴走防止の上限（5万件）。超えたら truncated=true で呼び出し側に知らせる。 */
const MAX_PAGES = 50;

export interface FermentationCostRow {
  userId: string;
  status: string;
  inputTokens: number | null;
  outputTokens: number | null;
  createdAt: string;
}

export interface UserCostAggregate {
  userId: string;
  fermentationCount: number;
  estimatedCostUsd: number;
  inputTokens: number;
  outputTokens: number;
}

export interface CostAggregate {
  estimatedCostUsd: number;
  inputTokens: number;
  outputTokens: number;
  fermentationCount: number;
  completedCount: number;
  failedCount: number;
  /** トークン未保存でコストを算出できなかった件数。過少計上の度合いを示す。 */
  untrackedCount: number;
  /** 推定コスト降順。 */
  byUser: UserCostAggregate[];
}

export interface FetchRowsResult {
  rows: FermentationCostRow[];
  /** MAX_PAGES に達して打ち切った場合 true。集計が過少であることを意味する。 */
  truncated: boolean;
}

interface FetchOptions {
  /** created_at >= startIso */
  startIso?: string;
  /** created_at <= endIso */
  endIso?: string;
  userId?: string;
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

/**
 * 期間内の fermentation_results を **全件** 取得する。
 *
 * 旧実装は .range() を付けずに投げていたため Supabase 既定の 1000 行で暗黙に
 * 打ち切られ、件数が増えるほど月次コストが黙って過少になっていた。
 */
export async function fetchFermentationCostRows(
  supabase: SupabaseClient,
  options: FetchOptions = {},
): Promise<FetchRowsResult> {
  const rows: FermentationCostRow[] = [];

  for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex++) {
    let query = supabase
      .from('fermentation_results')
      .select('user_id, status, input_tokens, output_tokens, created_at');
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
      rows.push({
        userId: row.user_id,
        status: row.status,
        inputTokens: toNullableNumber(row.input_tokens),
        outputTokens: toNullableNumber(row.output_tokens),
        createdAt: row.created_at,
      });
    }

    if (batch.length < PAGE_SIZE) return { rows, truncated: false };
  }

  return { rows, truncated: true };
}

/** 行の集合からコスト集計（合計・ステータス別件数・ユーザー別内訳）を作る。 */
export function aggregateCost(rows: FermentationCostRow[]): CostAggregate {
  const perUser = new Map<string, UserCostAggregate>();
  let estimatedCostUsd = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let completedCount = 0;
  let failedCount = 0;
  let untrackedCount = 0;

  for (const row of rows) {
    if (row.status === 'completed') completedCount++;
    if (row.status === 'failed') failedCount++;

    const cost = computeCostFromTokens(row.inputTokens, row.outputTokens, FERMENTATION_MODEL_RATE);
    if (!cost) untrackedCount++;

    const rowCost = cost?.totalCost ?? 0;
    const rowInput = cost?.promptTokens ?? 0;
    const rowOutput = cost?.completionTokens ?? 0;

    estimatedCostUsd += rowCost;
    inputTokens += rowInput;
    outputTokens += rowOutput;

    const current = perUser.get(row.userId) ?? {
      userId: row.userId,
      fermentationCount: 0,
      estimatedCostUsd: 0,
      inputTokens: 0,
      outputTokens: 0,
    };
    current.fermentationCount++;
    current.estimatedCostUsd += rowCost;
    current.inputTokens += rowInput;
    current.outputTokens += rowOutput;
    perUser.set(row.userId, current);
  }

  return {
    estimatedCostUsd,
    inputTokens,
    outputTokens,
    fermentationCount: rows.length,
    completedCount,
    failedCount,
    untrackedCount,
    byUser: Array.from(perUser.values()).sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd),
  };
}

export interface DailyCostAggregate {
  date: string;
  estimatedCostUsd: number;
  inputTokens: number;
  outputTokens: number;
  fermentationCount: number;
}

/**
 * 日別に集計する。日付キーの作り方（JST / UTC）は呼び出し側が決める。
 * Anthropic の実額と並べるときは UTC、運用レポートは JST を渡すこと。
 */
export function aggregateCostByDay(
  rows: FermentationCostRow[],
  toDateKey: (createdAt: string) => string,
): DailyCostAggregate[] {
  const perDay = new Map<string, DailyCostAggregate>();

  for (const row of rows) {
    const date = toDateKey(row.createdAt);
    const cost = computeCostFromTokens(row.inputTokens, row.outputTokens, FERMENTATION_MODEL_RATE);
    const current = perDay.get(date) ?? {
      date,
      estimatedCostUsd: 0,
      inputTokens: 0,
      outputTokens: 0,
      fermentationCount: 0,
    };
    current.estimatedCostUsd += cost?.totalCost ?? 0;
    current.inputTokens += cost?.promptTokens ?? 0;
    current.outputTokens += cost?.completionTokens ?? 0;
    current.fermentationCount++;
    perDay.set(date, current);
  }

  return Array.from(perDay.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/** user_id → email の解決。listUsers は 1000 件上限なのでページングする。 */
export async function resolveUserEmails(supabase: SupabaseClient): Promise<Map<string, string>> {
  const emailMap = new Map<string, string>();
  for (let page = 1; page <= 20; page++) {
    const { data } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    const users = data?.users ?? [];
    for (const user of users) {
      emailMap.set(user.id, user.email ?? '');
    }
    if (users.length < 1000) break;
  }
  return emailMap;
}
