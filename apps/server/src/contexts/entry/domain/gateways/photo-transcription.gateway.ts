/**
 * 写真から文字を起こす（OCR）ゲートウェイ。
 *
 * 実装は VLM（Claude）を使う。従来型 OCR ではなく VLM を選ぶ理由は
 * docs/entry-photo-guide.md を参照（手書き・縦書きへの強さと、整形まで 1 往復で
 * 済むこと）。トークン数とモデル名を返すのは、呼び出し側が使用量を記録して
 * コストを算出するため（photo_transcription_usages。単価はモデルごとに違う）。
 */
export interface PhotoTranscriptionResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface PhotoTranscriptionGateway {
  transcribe(
    image: ArrayBuffer,
    contentType: string,
    language: string,
  ): Promise<PhotoTranscriptionResult>;
}
