import { err, ok, type Result } from '../../../shared/domain/types/result.js';

type SnippetType = 'new_perspective' | 'deepen' | 'core';

type SnippetError = { type: 'INVALID_SNIPPET_TYPE'; message: string };

interface ExtractedSnippetProps {
  id: string;
  fermentationResultId: string;
  snippetType: SnippetType;
  originalText: string;
  sourceDate: string;
  selectionReason: string;
  /** Jar view position (0-100, percentage of the QuestionCircle). null → fall back. */
  jarX: number | null;
  jarY: number | null;
  createdAt: string;
  updatedAt: string;
}

const VALID_TYPES: SnippetType[] = ['new_perspective', 'deepen', 'core'];

export class ExtractedSnippet {
  readonly id: string;
  readonly fermentationResultId: string;
  readonly snippetType: SnippetType;
  readonly originalText: string;
  readonly sourceDate: string;
  readonly selectionReason: string;
  readonly jarX: number | null;
  readonly jarY: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;

  private constructor(props: ExtractedSnippetProps) {
    this.id = props.id;
    this.fermentationResultId = props.fermentationResultId;
    this.snippetType = props.snippetType;
    this.originalText = props.originalText;
    this.sourceDate = props.sourceDate;
    this.selectionReason = props.selectionReason;
    this.jarX = props.jarX;
    this.jarY = props.jarY;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(
    params: Omit<ExtractedSnippetProps, 'id' | 'jarX' | 'jarY' | 'createdAt' | 'updatedAt'>,
    generateId: () => string,
  ): Result<ExtractedSnippet, SnippetError> {
    if (!VALID_TYPES.includes(params.snippetType)) {
      return err({ type: 'INVALID_SNIPPET_TYPE', message: `Invalid type: ${params.snippetType}` });
    }
    const now = new Date().toISOString();
    return ok(
      new ExtractedSnippet({
        id: generateId(),
        ...params,
        jarX: null,
        jarY: null,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  static fromProps(props: ExtractedSnippetProps): ExtractedSnippet {
    return new ExtractedSnippet(props);
  }

  withJarPosition(jarX: number, jarY: number): ExtractedSnippet {
    return new ExtractedSnippet({
      ...this.toProps(),
      jarX,
      jarY,
      updatedAt: new Date().toISOString(),
    });
  }

  toProps(): ExtractedSnippetProps {
    return {
      id: this.id,
      fermentationResultId: this.fermentationResultId,
      snippetType: this.snippetType,
      originalText: this.originalText,
      sourceDate: this.sourceDate,
      selectionReason: this.selectionReason,
      jarX: this.jarX,
      jarY: this.jarY,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
