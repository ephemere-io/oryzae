/**
 * OCR のトークン使用量を残す先の境界。
 *
 * domain はどこに保存するか（Supabase か否か）を知らない。実装は infrastructure に置く。
 *
 * 記録が失敗しても OCR の結果は返す。呼び出しの課金は既に発生しており、
 * 記録できなかったことを理由にユーザーから読み取り結果を取り上げても取り返せない。
 * 「記録漏れ」は集計側で untracked として見える化する方針（fermentation と同じ）。
 */
export interface OcrUsageRecord {
  userId: string;
  /** 実際に使ったモデル ID。単価はモデルで変わるので事実として残す。 */
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface OcrUsageRecorder {
  record(usage: OcrUsageRecord): Promise<void>;
}
