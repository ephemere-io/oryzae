import { SpendLimitReachedError } from '../../../shared/application/errors/application.errors.js';
import { isSpendLimitError } from '../../../shared/infrastructure/anthropic-spend-limit.js';
import type { PhotoTranscriptionGateway } from '../../domain/gateways/photo-transcription.gateway.js';
import type { PhotoTranscriptionUsageRepositoryGateway } from '../../domain/gateways/photo-transcription-usage-repository.gateway.js';
import { PhotoTranscriptionUsage } from '../../domain/models/photo-transcription-usage.js';
import { EntryValidationError } from '../errors/entry.errors.js';

interface TranscribeEntryPhotoInput {
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
 * 写真から文字を起こす。起こした文字は返すだけで保存しない。
 *
 * 保存しないのは、起こした文字をユーザーが確認してから本文に入れるかどうかを決める
 * 設計にしているため（OCR は必ず外すので、勝手に本文を書き換えない）。本文に入れた
 * あとは通常のエントリ保存フローに乗る。
 *
 * 一方でトークン使用量は必ず記録する。1 リクエストが実費なので、集計できないと
 * コストが見えなくなるため（docs/entry-photo-guide.md）。
 */
export class TranscribeEntryPhotoUsecase {
  constructor(
    private transcription: PhotoTranscriptionGateway,
    private usageRepo: PhotoTranscriptionUsageRepositoryGateway,
    private generateId: () => string,
  ) {}

  async execute(input: TranscribeEntryPhotoInput): Promise<TranscribeEntryPhotoResponse> {
    let result: Awaited<ReturnType<PhotoTranscriptionGateway['transcribe']>>;
    try {
      result = await this.transcription.transcribe(input.file, input.contentType, input.language);
    } catch (error) {
      // 支出上限で止まっているだけなら、AI の失敗と混ぜない。
      // 「読み取れませんでした」と出すと原因不明の不具合に見えるため。
      if (isSpendLimitError(error)) {
        throw new SpendLimitReachedError('Anthropic spend limit reached');
      }
      throw error;
    }

    const usageResult = PhotoTranscriptionUsage.create(
      {
        userId: input.userId,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        charCount: result.text.length,
      },
      this.generateId,
    );
    if (!usageResult.success) {
      throw new EntryValidationError(usageResult.error.message);
    }

    await this.usageRepo.save(usageResult.value);

    return { text: result.text };
  }
}
