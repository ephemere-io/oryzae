import type { AnalysisWorksheet } from '../models/analysis-worksheet.js';
import type { ExtractedSnippet } from '../models/extracted-snippet.js';
import type { FermentationResult } from '../models/fermentation-result.js';
import type { Keyword } from '../models/keyword.js';
import type { Letter } from '../models/letter.js';

export interface FermentationResultWithDetails {
  result: FermentationResult;
  worksheet: AnalysisWorksheet | null;
  snippets: ExtractedSnippet[];
  letter: Letter | null;
  keywords: Keyword[];
  scannedEntryIds: string[];
}

export interface JarPositionUpdate {
  id: string;
  jarX: number;
  jarY: number;
}

export interface FermentationRepositoryGateway {
  save(result: FermentationResult): Promise<void>;
  update(result: FermentationResult): Promise<void>;
  findById(id: string): Promise<FermentationResult | null>;
  findByIdWithDetails(id: string): Promise<FermentationResultWithDetails | null>;
  listByQuestionId(questionId: string): Promise<FermentationResult[]>;

  /**
   * issue #353: 完了しなかった発酵を次回 cron でリトライするため、created_at が
   * [sinceIso, beforeIso) の範囲にある「未完了」の結果を取得する。
   *
   * 対象は status が 'failed' / 'processing' / 'pending' の行。'failed' は LLM 等で
   * 明示的に失敗した行、'processing' / 'pending' は Vercel が cron を実行途中で kill して
   * catch 節に到達できず宙ぶらりんになった行（#384 の症状）。どちらも「ユーザーに手紙が
   * 届いていない」状態なので等しくリトライ対象とする。
   *
   * リトライは行を再利用する（created_at 不変）ため、窓を約30hに取ると「前回 run の
   * 失敗」だけが入り、翌日には窓から外れる → 自然に「次回 cron で1回だけ」リトライになる。
   * beforeIso に cron 開始時刻を渡すことで、今 run 中に新規作成された行（created_at は
   * 開始時刻より後）は除外され、二重処理しない。
   */
  listRetryable(sinceIso: string, beforeIso: string): Promise<FermentationResult[]>;

  /**
   * issue #353: リトライで行を再利用する前に、過去の試行で部分的に保存され得る
   * 出力（worksheet/snippets/letter/keywords）を削除する。これらのテーブルは
   * fermentation_result_id に unique 制約が無く insert で保存されるため、
   * クリアしないと再実行で重複行ができる。
   */
  clearOutputs(fermentationResultId: string): Promise<void>;

  saveScannedEntries(fermentationResultId: string, entryIds: string[]): Promise<void>;
  listScannedEntryIds(fermentationResultId: string): Promise<string[]>;
  saveWorksheet(worksheet: AnalysisWorksheet): Promise<void>;
  saveSnippets(snippets: ExtractedSnippet[]): Promise<void>;
  saveLetter(letter: Letter): Promise<void>;
  saveKeywords(keywords: Keyword[]): Promise<void>;

  /**
   * Batch-update Jar view positions on the inner elements of a circle.
   * Cross-user writes are blocked by RLS (subquery joins on fermentation_results.user_id).
   */
  updateKeywordJarPositions(updates: JarPositionUpdate[]): Promise<void>;
  updateSnippetJarPositions(updates: JarPositionUpdate[]): Promise<void>;
  updateLetterJarPositions(updates: JarPositionUpdate[]): Promise<void>;
}
