import { MAX_OCR_IMAGE_BYTES, OCR_ALLOWED_IMAGE_TYPES } from '@oryzae/shared';
import type { OcrGateway } from '../../domain/gateways/ocr.gateway.js';
import { BoardOcrValidationError } from '../errors/board.errors.js';

interface ExtractTextFromImageInput {
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
 * ここで本文を 50 文字（MAX_SNIPPET_TEXT_LENGTH）に切り詰めないのは意図的。
 * 読み取り結果はまず全部見せて、削る判断はクライアント側のユーザーに委ねる。
 * 実際に 50 文字を強制するのは CreateBoardSnippetUsecase → BoardSnippet.create。
 */
export class ExtractTextFromImageUsecase {
  constructor(private ocr: OcrGateway) {}

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

    return { text: result.text };
  }
}
