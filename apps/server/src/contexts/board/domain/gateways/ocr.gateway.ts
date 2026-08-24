/**
 * 画像から文字を読み取る外部サービスの境界。
 *
 * domain は実装（どの LLM / OCR エンジンを使うか）を知らない。
 * 実装は infrastructure/ocr/ に置く。
 */

export interface OcrResult {
  /** 読み取れた本文。1文字も読み取れなかった場合は空文字。 */
  text: string;
  /** 発酵分析の LlmAnalysisResult と同じ形。将来コストを記録するときの取り出し口。 */
  usage: { inputTokens: number; outputTokens: number };
}

export interface OcrGateway {
  extractText(params: {
    image: ArrayBuffer;
    /** IANA メディアタイプ（例 'image/jpeg'）。 */
    mediaType: string;
  }): Promise<OcrResult>;
}
