import { err, ok, type Result } from '../../../shared/domain/types/result.js';

type PhotoTranscriptionUsageError =
  | { type: 'EMPTY_MODEL'; message: string }
  | { type: 'NEGATIVE_TOKENS'; message: string };

export interface PhotoTranscriptionUsageProps {
  id: string;
  userId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  charCount: number;
  createdAt: string;
}

interface CreatePhotoTranscriptionUsageParams {
  userId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  charCount: number;
}

/**
 * 写真の文字起こし 1 回分のトークン使用量。
 *
 * 起こした文字そのものは持たない（日記の中身であり、本文に入れれば entries に残る）。
 * モデル名を持つのは、あとからモデルを差し替えても過去分が誤った単価で再計算されない
 * ようにするため — コスト算出は claude-pricing.ts がモデル別の価格表で行う。
 */
export class PhotoTranscriptionUsage {
  readonly id: string;
  readonly userId: string;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly charCount: number;
  readonly createdAt: string;

  private constructor(props: PhotoTranscriptionUsageProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.model = props.model;
    this.inputTokens = props.inputTokens;
    this.outputTokens = props.outputTokens;
    this.charCount = props.charCount;
    this.createdAt = props.createdAt;
  }

  static create(
    params: CreatePhotoTranscriptionUsageParams,
    generateId: () => string,
  ): Result<PhotoTranscriptionUsage, PhotoTranscriptionUsageError> {
    if (params.model.trim().length === 0) {
      return err({ type: 'EMPTY_MODEL', message: 'Model must not be empty' });
    }
    if (params.inputTokens < 0 || params.outputTokens < 0 || params.charCount < 0) {
      return err({ type: 'NEGATIVE_TOKENS', message: 'Token counts must not be negative' });
    }

    return ok(
      new PhotoTranscriptionUsage({
        id: generateId(),
        userId: params.userId,
        model: params.model,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        charCount: params.charCount,
        createdAt: new Date().toISOString(),
      }),
    );
  }

  static fromProps(props: PhotoTranscriptionUsageProps): PhotoTranscriptionUsage {
    return new PhotoTranscriptionUsage(props);
  }

  toProps(): PhotoTranscriptionUsageProps {
    return {
      id: this.id,
      userId: this.userId,
      model: this.model,
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      charCount: this.charCount,
      createdAt: this.createdAt,
    };
  }
}
