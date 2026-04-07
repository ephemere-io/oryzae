import { err, ok, type Result } from '../../../shared/domain/types/result.js';

export type SnippetType = 'new_perspective' | 'deepen' | 'core';

type SnippetError = { type: 'INVALID_SNIPPET_TYPE'; message: string };

export interface ExtractedSnippetProps {
  id: string;
  fermentationResultId: string;
  snippetType: SnippetType;
  originalText: string;
  sourceDate: string;
  selectionReason: string;
}

const VALID_TYPES: SnippetType[] = ['new_perspective', 'deepen', 'core'];

export class ExtractedSnippet {
  readonly id: string;
  readonly fermentationResultId: string;
  readonly snippetType: SnippetType;
  readonly originalText: string;
  readonly sourceDate: string;
  readonly selectionReason: string;

  private constructor(props: ExtractedSnippetProps) {
    this.id = props.id;
    this.fermentationResultId = props.fermentationResultId;
    this.snippetType = props.snippetType;
    this.originalText = props.originalText;
    this.sourceDate = props.sourceDate;
    this.selectionReason = props.selectionReason;
  }

  static create(
    params: Omit<ExtractedSnippetProps, 'id'>,
    generateId: () => string,
  ): Result<ExtractedSnippet, SnippetError> {
    if (!VALID_TYPES.includes(params.snippetType)) {
      return err({ type: 'INVALID_SNIPPET_TYPE', message: `Invalid type: ${params.snippetType}` });
    }
    return ok(new ExtractedSnippet({ id: generateId(), ...params }));
  }

  static fromProps(props: ExtractedSnippetProps): ExtractedSnippet {
    return new ExtractedSnippet(props);
  }

  toProps(): ExtractedSnippetProps {
    return {
      id: this.id,
      fermentationResultId: this.fermentationResultId,
      snippetType: this.snippetType,
      originalText: this.originalText,
      sourceDate: this.sourceDate,
      selectionReason: this.selectionReason,
    };
  }
}
