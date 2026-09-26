/**
 * 画像の文字起こし（ボード OCR / 写真の文字起こし）の呼び出しを 1 回ごとに記録する境界。
 *
 * **OCR 専用。** 発酵は結果の記録（fermentation_results）にユーザーとトークン数が
 * 最初から付いているのでここには入れない。OCR は何も保存しない機能なので、
 * 「誰が使ったか」を残す場所がここにしか無い。
 *
 * 目的は日次コストレポートの「誰が何回使ったか」。金額は持たない——実請求額は
 * Anthropic の cost_report が正で、ここに要るのは Anthropic が構造的に持てない
 * 「Oryzae のどのユーザーか」だけ。
 *
 * **本文は渡さない。** 読み取った文字や画像は日記の中身なので、境界の型に入れる口を作らない。
 */

/** どこから呼ばれた OCR か。API キー（oryzae-prod-ocr-board / -entry）と同じ分け方。 */
export type OcrUsageSource = 'board' | 'entry';

export interface OcrUsageEvent {
  userId: string;
  source: OcrUsageSource;
  /** 失敗して応答が無かった呼び出しは null。 */
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  succeeded: boolean;
}

export interface OcrUsageRecorder {
  record(event: OcrUsageEvent): Promise<void>;
}
