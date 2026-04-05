import {
  NotFoundError,
  ValidationError,
} from '../../../shared/application/errors/application.errors.js';

export class EntryNotFoundError extends NotFoundError {
  constructor(entryId: string) {
    super(`Entry not found: ${entryId}`);
  }
}

export class EntryValidationError extends ValidationError {}
