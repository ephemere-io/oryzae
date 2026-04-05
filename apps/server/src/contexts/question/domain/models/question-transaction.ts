import { err, ok, type Result } from '../../../shared/domain/types/result.js';

type QuestionTransactionError =
  | { type: 'EMPTY_STRING'; message: string }
  | { type: 'STRING_TOO_LONG'; message: string };

export interface QuestionTransactionProps {
  id: string;
  questionId: string;
  string: string;
  questionVersion: number;
  isValidatedByUser: boolean;
  isProposedByOryzae: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CreateQuestionTransactionParams {
  questionId: string;
  string: string;
  questionVersion: number;
  isProposedByOryzae: boolean;
}

const MAX_STRING_LENGTH = 64;

export class QuestionTransaction {
  readonly id: string;
  readonly questionId: string;
  readonly string: string;
  readonly questionVersion: number;
  readonly isValidatedByUser: boolean;
  readonly isProposedByOryzae: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;

  private constructor(props: QuestionTransactionProps) {
    this.id = props.id;
    this.questionId = props.questionId;
    this.string = props.string;
    this.questionVersion = props.questionVersion;
    this.isValidatedByUser = props.isValidatedByUser;
    this.isProposedByOryzae = props.isProposedByOryzae;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(
    params: CreateQuestionTransactionParams,
    generateId: () => string,
  ): Result<QuestionTransaction, QuestionTransactionError> {
    const validationError = QuestionTransaction.validateString(params.string);
    if (validationError) return err(validationError);

    const now = new Date().toISOString();
    return ok(
      new QuestionTransaction({
        id: generateId(),
        questionId: params.questionId,
        string: params.string,
        questionVersion: params.questionVersion,
        isValidatedByUser: !params.isProposedByOryzae,
        isProposedByOryzae: params.isProposedByOryzae,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  static fromProps(props: QuestionTransactionProps): QuestionTransaction {
    return new QuestionTransaction(props);
  }

  withValidated(): QuestionTransaction {
    return new QuestionTransaction({
      ...this.toProps(),
      isValidatedByUser: true,
      updatedAt: new Date().toISOString(),
    });
  }

  toProps(): QuestionTransactionProps {
    return {
      id: this.id,
      questionId: this.questionId,
      string: this.string,
      questionVersion: this.questionVersion,
      isValidatedByUser: this.isValidatedByUser,
      isProposedByOryzae: this.isProposedByOryzae,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  private static validateString(str: string): QuestionTransactionError | null {
    if (str.trim().length === 0) {
      return { type: 'EMPTY_STRING', message: 'Question text must not be empty' };
    }
    if (str.length > MAX_STRING_LENGTH) {
      return {
        type: 'STRING_TOO_LONG',
        message: `Question text exceeds maximum length of ${MAX_STRING_LENGTH}`,
      };
    }
    return null;
  }
}
