import {
  NotFoundError,
  ValidationError,
} from '../../../shared/application/errors/application.errors';

export class QuestionNotFoundError extends NotFoundError {
  constructor(questionId: string) {
    super(`Question not found: ${questionId}`);
  }
}

export class QuestionValidationError extends ValidationError {
  constructor(message: string) {
    super(message);
  }
}

export class QuestionLimitExceededError extends ValidationError {
  constructor() {
    super('Maximum of 3 active questions per user');
  }
}

export class QuestionNotPendingError extends ValidationError {
  constructor(questionId: string) {
    super(`Question is not a pending proposal: ${questionId}`);
  }
}
