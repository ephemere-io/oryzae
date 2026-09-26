/**
 * ユーザーが AI の機能を 1 回使ったことを記録する境界（表 ai_usage）。
 *
 * 発酵・ボード OCR・写真の文字起こしのどれも、ここを通して同じ形で残す。
 * 目的は「誰が・いつ・どの機能を・何トークン使ったか」を 1 か所で数えられること
 * （日次コストレポートのユーザー別内訳、管理画面のユーザー別推定額）。
 *
 * 金額は持たない。実請求額は Anthropic の cost_report が正。
 * **日記の中身は渡さない。** 本文や読み取った文字を入れる口を型に作らない。
 */

/** どの機能か。API キーの分け方と同じ。 */
export type AiFeature = 'fermentation' | 'ocr_board' | 'ocr_entry';

export interface AiUsage {
  userId: string;
  feature: AiFeature;
  /** 何に対する利用か。発酵なら fermentation_results の id。OCR は保存物が無いので null。 */
  refId: string | null;
  inputTokens: number;
  outputTokens: number;
}

export interface AiUsageRecorder {
  record(usage: AiUsage): Promise<void>;
}
