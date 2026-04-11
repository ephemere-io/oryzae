import { err, ok, type Result } from '../../../shared/domain/types/result.js';

const MAX_TEXT_LENGTH = 50;

type BoardSnippetError =
  | { type: 'EMPTY_TEXT'; message: string }
  | { type: 'TEXT_TOO_LONG'; message: string };

interface BoardSnippetProps {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateBoardSnippetParams {
  userId: string;
  text: string;
}

export class BoardSnippet {
  readonly id: string;
  readonly userId: string;
  readonly text: string;
  readonly createdAt: string;
  readonly updatedAt: string;

  private constructor(props: BoardSnippetProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.text = props.text;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(
    params: CreateBoardSnippetParams,
    generateId: () => string,
  ): Result<BoardSnippet, BoardSnippetError> {
    const textError = BoardSnippet.validateText(params.text);
    if (textError) return err(textError);

    const now = new Date().toISOString();
    return ok(
      new BoardSnippet({
        id: generateId(),
        userId: params.userId,
        text: params.text,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  static fromProps(props: BoardSnippetProps): BoardSnippet {
    return new BoardSnippet(props);
  }

  withText(text: string): Result<BoardSnippet, BoardSnippetError> {
    const textError = BoardSnippet.validateText(text);
    if (textError) return err(textError);

    return ok(
      new BoardSnippet({
        ...this.toProps(),
        text,
        updatedAt: new Date().toISOString(),
      }),
    );
  }

  toProps(): BoardSnippetProps {
    return {
      id: this.id,
      userId: this.userId,
      text: this.text,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  private static validateText(text: string): BoardSnippetError | null {
    if (text.trim().length === 0) {
      return { type: 'EMPTY_TEXT', message: 'Snippet text must not be empty' };
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return {
        type: 'TEXT_TOO_LONG',
        message: `Snippet text must not exceed ${MAX_TEXT_LENGTH} characters`,
      };
    }
    return null;
  }
}
