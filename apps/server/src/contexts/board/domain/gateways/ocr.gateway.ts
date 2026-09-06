/**
 * 画像から文字を読み取る外部サービスの境界。
 *
 * domain は実装（どの LLM / OCR エンジンを使うか）を知らない。
 * 実装は infrastructure/ocr/ に置く。
 */

export interface OcrResult {
  /** 読み取れた本文。1文字も読み取れなかった場合は空文字。 */
  text: string;
  /**
   * 実際に使ったモデル ID。
   *
   * 単価はモデルで変わる（OCR の claude-opus-5 は発酵の claude-sonnet-4-6 より高い）。
   * 記録側がモデルを推測すると、モデルを差し替えたときに黙って誤った単価で金額化される。
   * 「どのモデルで何トークン使ったか」を事実として持ち回るためにここで返す。
   */
  model: string;
  /** 発酵分析の LlmAnalysisResult と同じ形。ocr_usage に記録してコスト集計に載せる。 */
  usage: { inputTokens: number; outputTokens: number };
}

export interface OcrGateway {
  extractText(params: {
    image: ArrayBuffer;
    /** IANA メディアタイプ（例 'image/jpeg'）。 */
    mediaType: string;
  }): Promise<OcrResult>;
}
