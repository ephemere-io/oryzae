import { NotFoundError } from '../../../shared/application/errors/application.errors.js';

export class UserProfileNotFoundError extends NotFoundError {
  constructor(userId: string) {
    super(`User profile not found: ${userId}`);
  }
}
