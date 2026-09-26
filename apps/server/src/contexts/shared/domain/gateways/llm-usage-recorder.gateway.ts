/**
 * LLM の呼び出しを 1 回ごとに記録する境界。
 *
 * 目的は日次コストレポートの「誰が何回使ったか」。金額は持たない——実請求額は
 * Anthropic の cost_report が正で、ここに要るのは Anthropic が構造的に持てない
 * 「Oryzae のどのユーザーか」だけ。
 *
 * **本文は渡さない。** 読み取った文字や画像は日記の中身なので、境界の型に入れる口を作らない。
 */

/** 記録対象の機能。発酵は fermentation_results に既にあるので含めない。 */
export type LlmUsageFeature = 'ocr_board' | 'ocr_entry';

export interface LlmUsageEvent {
  userId: string;
  feature: LlmUsageFeature;
  /** 失敗して応答が無かった呼び出しは null。 */
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  succeeded: boolean;
}

export interface LlmUsageRecorder {
  record(event: LlmUsageEvent): Promise<void>;
}
