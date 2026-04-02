import {
  type Result,
  ok,
  err,
} from '../../../shared/domain/types/result';

export type EntryError =
  | { type: 'EMPTY_CONTENT'; message: string }
  | { type: 'CONTENT_TOO_LONG'; message: string };

export interface EntryProps {
  id: string;
  userId: string;
  content: string;
  mediaUrls: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateEntryParams {
  userId: string;
  content: string;
  mediaUrls: string[];
}

const MAX_CONTENT_LENGTH = 100_000;

export class Entry {
  readonly id: string;
  readonly userId: string;
  readonly content: string;
  readonly mediaUrls: string[];
  readonly createdAt: string;
  readonly updatedAt: string;

  private constructor(props: EntryProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.content = props.content;
    this.mediaUrls = props.mediaUrls;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(
    params: CreateEntryParams,
    generateId: () => string,
  ): Result<Entry, EntryError> {
    const validationError = Entry.validateContent(params.content);
    if (validationError) return err(validationError);

    const now = new Date().toISOString();
    return ok(
      new Entry({
        id: generateId(),
        userId: params.userId,
        content: params.content,
        mediaUrls: params.mediaUrls,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  static fromProps(props: EntryProps): Entry {
    return new Entry(props);
  }

  withContent(
    content: string,
    mediaUrls: string[],
  ): Result<Entry, EntryError> {
    const validationError = Entry.validateContent(content);
    if (validationError) return err(validationError);

    return ok(
      new Entry({
        ...this.toProps(),
        content,
        mediaUrls,
        updatedAt: new Date().toISOString(),
      }),
    );
  }

  toProps(): EntryProps {
    return {
      id: this.id,
      userId: this.userId,
      content: this.content,
      mediaUrls: this.mediaUrls,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  private static validateContent(
    content: string,
  ): EntryError | null {
    if (content.trim().length === 0) {
      return { type: 'EMPTY_CONTENT', message: 'Content must not be empty' };
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      return {
        type: 'CONTENT_TOO_LONG',
        message: `Content exceeds maximum length of ${MAX_CONTENT_LENGTH}`,
      };
    }
    return null;
  }
}
