import {
  NotFoundError,
  ValidationError,
} from '../../../shared/application/errors/application.errors.js';

export class BoardSnippetNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Board snippet not found: ${id}`);
  }
}

export class BoardPhotoNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Board photo not found: ${id}`);
  }
}

/**
 * 盤面に置こうとした日記が見つからない（他人のもの、または削除済み）。
 *
 * entry コンテキストの EntryNotFoundError は使わない。board から entry の
 * application 層は参照できず（コンテキスト隔離）、参照できるのは domain の
 * gateway だけなので、board 側の語彙で持つ。
 */
export class BoardEntryNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Entry not found or not owned by the user: ${id}`);
  }
}

export class BoardCardValidationError extends ValidationError {}

export class BoardSnippetValidationError extends ValidationError {}

export class BoardPhotoValidationError extends ValidationError {}

export class BoardOcrValidationError extends ValidationError {}
