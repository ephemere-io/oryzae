import { MAX_OCR_IMAGE_BYTES, OCR_ALLOWED_IMAGE_TYPES } from '@oryzae/shared';
import { recordOcrUsage } from '../../../shared/application/record-ocr-usage.js';
import type { OcrUsageRecorder } from '../../../shared/domain/gateways/ocr-usage-recorder.gateway.js';
import type { OcrGateway } from '../../domain/gateways/ocr.gateway.js';
import { BoardOcrValidationError } from '../errors/board.errors.js';

interface ExtractTextFromImageInput {
  /** 利用記録（誰が使ったか）に残す。 */
  userId: string;
  image: ArrayBuffer;
  mediaType: string;
}

interface ExtractTextFromImageResponse {
  text: string;
}

function isAllowedMediaType(mediaType: string): boolean {
  return OCR_ALLOWED_IMAGE_TYPES.some((allowed) => allowed === mediaType);
}

/**
 * 画像から文字を読み取り、スニペットの下書きとして返す（issue: ボードのツールバー刷新）。
 *
 * 読み取り結果はここで削らず全部返す。上限（MAX_OCR_TEXT_LENGTH）はスニペット本体の
 * 上限（MAX_SNIPPET_TEXT_LENGTH）と同じ値なので、読み取れたものはそのまま保存できる。
 * 実際に上限を強制するのは CreateBoardSnippetUsecase → BoardSnippet.create。
 */
export class ExtractTextFromImageUsecase {
  constructor(
    private ocr: OcrGateway,
    private usage: OcrUsageRecorder,
  ) {}

  async execute(input: ExtractTextFromImageInput): Promise<ExtractTextFromImageResponse> {
    if (!isAllowedMediaType(input.mediaType)) {
      throw new BoardOcrValidationError(`Unsupported image type: ${input.mediaType}`);
    }
    if (input.image.byteLength === 0) {
      throw new BoardOcrValidationError('Image must not be empty');
    }
    if (input.image.byteLength > MAX_OCR_IMAGE_BYTES) {
      throw new BoardOcrValidationError(
        `Image must be ${MAX_OCR_IMAGE_BYTES} bytes or less (got ${input.image.byteLength})`,
      );
    }

    // 入力検証で弾いたものは LLM を呼んでいないので記録しない。ここから先は 1 回の呼び出し。
    let result: Awaited<ReturnType<OcrGateway['extractText']>>;
    try {
      result = await this.ocr.extractText({
        image: input.image,
        mediaType: input.mediaType,
      });
    } catch (error) {
      await recordOcrUsage(this.usage, {
        userId: input.userId,
        source: 'board',
        model: null,
        inputTokens: null,
        outputTokens: null,
        succeeded: false,
      });
      throw error;
    }

    await recordOcrUsage(this.usage, {
      userId: input.userId,
      source: 'board',
      model: result.model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      succeeded: true,
    });
    return { text: result.text };
  }
}
