import { MAX_OCR_IMAGE_BYTES, OCR_ALLOWED_IMAGE_TYPES } from '@oryzae/shared';
import type { OcrGateway } from '../../domain/gateways/ocr.gateway.js';
import type { OcrUsageRecorder } from '../../domain/gateways/ocr-usage.recorder.js';
import { BoardOcrValidationError } from '../errors/board.errors.js';

interface ExtractTextFromImageInput {
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
 *
 * トークン使用量は必ず記録する。OCR は発酵と違って呼び出しごとに残るレコードが無く
 * （読み取っただけでスニペットを作らない場合もある）、記録しないと課金だけが発生して
 * コスト集計には $0 として現れる。実際そうなっており、実請求額との差の一因だった。
 */
export class ExtractTextFromImageUsecase {
  constructor(
    private ocr: OcrGateway,
    private usageRecorder: OcrUsageRecorder,
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

    const result = await this.ocr.extractText({
      image: input.image,
      mediaType: input.mediaType,
    });

    // 記録の失敗で読み取り結果を捨てない。課金は既に発生していて取り返せないので、
    // ユーザーから結果を取り上げても損失が増えるだけ。落ちたことはログに残す
    // （集計側は「記録された分だけ」を出すので、漏れは実額との差として現れる）。
    try {
      await this.usageRecorder.record({
        userId: input.userId,
        model: result.model,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      });
    } catch (error) {
      console.error('[ExtractTextFromImageUsecase] OCR 使用量の記録に失敗', {
        userId: input.userId,
        model: result.model,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return { text: result.text };
  }
}
