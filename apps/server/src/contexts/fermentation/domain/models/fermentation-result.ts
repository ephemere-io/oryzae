import { err, ok, type Result } from '../../../shared/domain/types/result.js';

export type FermentationStatus = 'pending' | 'processing' | 'completed' | 'failed';

type FermentationResultError = { type: 'INVALID_STATUS'; message: string };

export interface FermentationResultProps {
  id: string;
  userId: string;
  questionId: string;
  entryId: string;
  targetPeriod: string;
  status: FermentationStatus;
  createdAt: string;
  updatedAt: string;
}

interface CreateParams {
  userId: string;
  questionId: string;
  entryId: string;
  targetPeriod: string;
}

const VALID_STATUSES: FermentationStatus[] = ['pending', 'processing', 'completed', 'failed'];

export class FermentationResult {
  readonly id: string;
  readonly userId: string;
  readonly questionId: string;
  readonly entryId: string;
  readonly targetPeriod: string;
  readonly status: FermentationStatus;
  readonly createdAt: string;
  readonly updatedAt: string;

  private constructor(props: FermentationResultProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.questionId = props.questionId;
    this.entryId = props.entryId;
    this.targetPeriod = props.targetPeriod;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(
    params: CreateParams,
    generateId: () => string,
  ): Result<FermentationResult, FermentationResultError> {
    if (!params.targetPeriod.trim()) {
      return err({ type: 'INVALID_STATUS', message: 'Target period is required' });
    }
    return ok(
      new FermentationResult({
        id: generateId(),
        userId: params.userId,
        questionId: params.questionId,
        entryId: params.entryId,
        targetPeriod: params.targetPeriod,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    );
  }

  static fromProps(props: FermentationResultProps): FermentationResult {
    return new FermentationResult(props);
  }

  withStatus(status: FermentationStatus): Result<FermentationResult, FermentationResultError> {
    if (!VALID_STATUSES.includes(status)) {
      return err({ type: 'INVALID_STATUS', message: `Invalid status: ${status}` });
    }
    return ok(new FermentationResult({ ...this.toProps(), status }));
  }

  toProps(): FermentationResultProps {
    return {
      id: this.id,
      userId: this.userId,
      questionId: this.questionId,
      entryId: this.entryId,
      targetPeriod: this.targetPeriod,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
