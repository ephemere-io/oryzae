import type { Entry } from '../models/entry.js';

/** 一覧の作成日ソート順。'newest'=新しい順(降順, 既定) / 'oldest'=古い順(昇順)。 */
export type EntryListOrder = 'newest' | 'oldest';

/** ある月に書かれた記録の件数。month は利用者のローカル暦月（`YYYY-MM`）。 */
export interface MonthlyEntryCount {
  month: string;
  count: number;
}

/** ローカル暦月で絞るときの指定。月だけでは時差ぶんの境界が決まらない。 */
export interface EntryMonthFilter {
  /** `YYYY-MM`。 */
  month: string;
  /** `Date.prototype.getTimezoneOffset()` と同じ符号（JST は -540）。 */
  tzOffsetMinutes: number;
}

export interface EntryRepositoryGateway {
  findById(id: string): Promise<Entry | null>;
  findByIds(ids: string[]): Promise<Entry[]>;
  // Issue #331: questionId が与えられたら、その問いに紐づく entry のみ返す
  // order: created_at の並び順（既定 'newest'）。cursor は created_at 値。
  listByUserId(
    userId: string,
    cursor?: string,
    limit?: number,
    questionId?: string,
    order?: EntryListOrder,
    // 書斎の一覧（docs/oryzae-study）用。`YYYY-MM` のローカル暦月で絞る。
    // 件数（countByMonth）と同じ月の切り方でなければ、手帳の厚みと一覧が食い違う。
    month?: EntryMonthFilter,
  ): Promise<Entry[]>;
  listByUserIdAndDate(userId: string, dateKey: string, tzOffsetMinutes?: number): Promise<Entry[]>;
  listFermentationEnabledByUserIdAndDate(userId: string, dateKey: string): Promise<Entry[]>;
  // 発酵自動発火 (issue #268) 用。sinceIso が null の場合は全期間。
  listFermentationEnabledByUserIdSince(userId: string, sinceIso: string | null): Promise<Entry[]>;
  // 文字数閾値判定用。fermentation_enabled に関わらず全エントリの文字数を合算する
  // (issue 文 "書いた全てのエントリーの合計文字数" の素直な解釈)。
  countCharsByUserIdSince(userId: string, sinceIso: string | null): Promise<number>;
  // 書斎の手帳（docs/oryzae-study）用。月ごとの件数を新しい月から並べて返す。
  // 月は tzOffsetMinutes で決まる**利用者のローカル暦月**（UTC 基準ではない）。
  countByMonth(userId: string, tzOffsetMinutes?: number): Promise<MonthlyEntryCount[]>;
  listByUserIdAndWeek(userId: string, dateKey: string, tzOffsetMinutes?: number): Promise<Entry[]>;
  // Issue #331: questionId が与えられたら、その問いに紐づく entry の中から検索する
  searchByUserId(
    userId: string,
    query: string,
    cursor?: string,
    limit?: number,
    questionId?: string,
    order?: EntryListOrder,
  ): Promise<Entry[]>;
  save(entry: Entry): Promise<void>;
  delete(id: string): Promise<void>;
}
