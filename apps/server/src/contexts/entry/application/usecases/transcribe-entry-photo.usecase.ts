import { SpendLimitReachedError } from '../../../shared/application/errors/application.errors.js';
import { isSpendLimitError } from '../../../shared/infrastructure/anthropic-spend-limit.js';
import type { PhotoTranscriptionGateway } from '../../domain/gateways/photo-transcription.gateway.js';

interface TranscribeEntryPhotoInput {
  file: ArrayBuffer;
  contentType: string;
  /** 文字起こしのヒントに使う UI ロケール（'ja' | 'en' | ...）。 */
  language: string;
}

interface TranscribeEntryPhotoResponse {
  text: string;
}

/**
 * 写真から文字を起こす。起こした文字はどこにも保存せず、そのまま返すだけ。
 *
 * 保存しないのは、起こした文字をユーザーが確認してから本文に入れるかどうかを決める
 * 設計にしているため（OCR は必ず外すので、勝手に本文を書き換えない）。本文に入れた
 * あとは通常のエントリ保存フローに乗る。
 *
 * トークン使用量もここでは記録しない。コストは Cost API（`anthropic-cost-api.ts`）が
 * 組織全体の**実請求額**として拾うので、自前で数える必要が無いため。機能別・ユーザー別の
 * 内訳が要るようになったら、発酵と同じ形（`fermentation-cost-query.ts` 相当）で足すこと。
 */
export class TranscribeEntryPhotoUsecase {
  constructor(private transcription: PhotoTranscriptionGateway) {}

  async execute(input: TranscribeEntryPhotoInput): Promise<TranscribeEntryPhotoResponse> {
    try {
      const result = await this.transcription.transcribe(
        input.file,
        input.contentType,
        input.language,
      );
      return { text: result.text };
    } catch (error) {
      // 支出上限で止まっているだけなら、AI の失敗と混ぜない。
      // 「読み取れませんでした」と出すと原因不明の不具合に見えるため。
      if (isSpendLimitError(error)) {
        throw new SpendLimitReachedError('Anthropic spend limit reached');
      }
      throw error;
    }
  }
}
