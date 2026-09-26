import { SpendLimitReachedError } from '../../../shared/application/errors/application.errors.js';
import { recordOcrUsage } from '../../../shared/application/record-ocr-usage.js';
import type { OcrUsageRecorder } from '../../../shared/domain/gateways/ocr-usage-recorder.gateway.js';
import { isSpendLimitError } from '../../../shared/infrastructure/anthropic-spend-limit.js';
import type { PhotoTranscriptionGateway } from '../../domain/gateways/photo-transcription.gateway.js';

interface TranscribeEntryPhotoInput {
  /** 利用記録（誰が使ったか）に残す。 */
  userId: string;
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
 * 呼び出し 1 回ごとに「誰が・どのモデルで・何トークン」を ocr_usage_events に残す
 * （日次コストレポートのユーザー別内訳のため。起こした文字は残さない）。
 * 金額は持たない——実請求額は Cost API（`anthropic-cost-api.ts`）が Workspace 別に取る。
 */
export class TranscribeEntryPhotoUsecase {
  constructor(
    private transcription: PhotoTranscriptionGateway,
    private usage: OcrUsageRecorder,
  ) {}

  async execute(input: TranscribeEntryPhotoInput): Promise<TranscribeEntryPhotoResponse> {
    try {
      const result = await this.transcription.transcribe(
        input.file,
        input.contentType,
        input.language,
      );
      await recordOcrUsage(this.usage, {
        userId: input.userId,
        source: 'entry',
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        succeeded: true,
      });
      return { text: result.text };
    } catch (error) {
      await recordOcrUsage(this.usage, {
        userId: input.userId,
        source: 'entry',
        model: null,
        inputTokens: null,
        outputTokens: null,
        succeeded: false,
      });
      // 支出上限で止まっているだけなら、AI の失敗と混ぜない。
      // 「読み取れませんでした」と出すと原因不明の不具合に見えるため。
      if (isSpendLimitError(error)) {
        throw new SpendLimitReachedError('Anthropic spend limit reached');
      }
      throw error;
    }
  }
}
