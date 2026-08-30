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

/**
 * Anthropic の支出上限・残高切れで止まっている状態。
 *
 * 503 にするのは「こちらの不具合ではなく、一時的に使えない」ことを表すため。
 * 上限を上げるか翌月になれば回復するので、クライアントは再試行を促せる。
 */
export class SpendLimitReachedError extends ApplicationError {
  readonly statusCode = 503;
}
