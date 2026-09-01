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
   * 発酵分析の LlmAnalysisResult と同じ形。将来コストを記録するときの取り出し口。
   *
   * ⚠️ **`claude-pricing.ts` の calculateCost() をそのまま当てないこと。** あちらは
   * 単一モデル前提で claude-sonnet-4-6 の単価しか持たない。OCR は別モデル
   * （claude-opus-5）で動いているので、そのまま通すと単価が何倍もずれた金額を
   * 「正しい数字」として出してしまい、しかも何も失敗しないので気づけない。
   * 記録するなら、先に単価表を複数モデル対応にすること。
   */
  usage: { inputTokens: number; outputTokens: number };
}

export interface OcrGateway {
  extractText(params: {
    image: ArrayBuffer;
    /** IANA メディアタイプ（例 'image/jpeg'）。 */
    mediaType: string;
  }): Promise<OcrResult>;
}
