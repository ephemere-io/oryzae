import type { Entry } from '../models/entry.js';

export interface EntryRepositoryGateway {
  findById(id: string): Promise<Entry | null>;
  findByIds(ids: string[]): Promise<Entry[]>;
  listByUserId(userId: string, cursor?: string, limit?: number): Promise<Entry[]>;
  listByUserIdAndDate(userId: string, dateKey: string): Promise<Entry[]>;
  listFermentationEnabledByUserIdAndDate(userId: string, dateKey: string): Promise<Entry[]>;
  // 発酵自動発火 (issue #268) 用。sinceIso が null の場合は全期間。
  listFermentationEnabledByUserIdSince(userId: string, sinceIso: string | null): Promise<Entry[]>;
  // 文字数閾値判定用。fermentation_enabled に関わらず全エントリの文字数を合算する
  // (issue 文 "書いた全てのエントリーの合計文字数" の素直な解釈)。
  countCharsByUserIdSince(userId: string, sinceIso: string | null): Promise<number>;
  listByUserIdAndWeek(userId: string, dateKey: string): Promise<Entry[]>;
  searchByUserId(userId: string, query: string, cursor?: string, limit?: number): Promise<Entry[]>;
  save(entry: Entry): Promise<void>;
  delete(id: string): Promise<void>;
}
