import { ApplicationError } from '../../../shared/application/errors/application.errors.js';

export class FermentationNotFoundError extends ApplicationError {
  readonly statusCode = 404;
  constructor(id: string) {
    super(`Fermentation result not found: ${id}`);
  }
}

export class LlmAnalysisError extends ApplicationError {
  readonly statusCode = 502;
  constructor(message: string) {
    super(`LLM analysis failed: ${message}`);
  }
}
