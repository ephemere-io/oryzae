export abstract class ApplicationError extends Error {
  abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends ApplicationError {
  readonly statusCode = 400;
}

export class NotFoundError extends ApplicationError {
  readonly statusCode = 404;
}
