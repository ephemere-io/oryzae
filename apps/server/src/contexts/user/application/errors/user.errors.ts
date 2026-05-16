import {
  NotFoundError,
  ValidationError,
} from '../../../shared/application/errors/application.errors.js';

export class UserProfileNotFoundError extends NotFoundError {
  constructor(userId: string) {
    super(`User profile not found: ${userId}`);
  }
}

export class AuthUserNotFoundError extends NotFoundError {
  constructor(userId: string) {
    super(`Auth user not found: ${userId}`);
  }
}

export class CannotDeleteSelfError extends ValidationError {
  constructor() {
    super('Admin cannot delete their own account');
  }
}
