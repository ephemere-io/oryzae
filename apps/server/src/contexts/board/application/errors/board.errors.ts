import {
  NotFoundError,
  ValidationError,
} from '../../../shared/application/errors/application.errors.js';

export class BoardSnippetNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Board snippet not found: ${id}`);
  }
}

export class BoardCardValidationError extends ValidationError {}

export class BoardSnippetValidationError extends ValidationError {}
