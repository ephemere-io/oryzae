import { err, ok, type Result } from '../../../shared/domain/types/result.js';

type EntryError =
  | { type: 'EMPTY_CONTENT'; message: string }
  | { type: 'CONTENT_TOO_LONG'; message: string };

/**
 * Editor visual effects state — persisted with the entry.
 *
 * Defined locally in the domain (rather than imported from `@oryzae/shared`)
 * because the domain layer must stay zod-free per `domain-no-shared-package`.
 * Shared owns the matching zod schema for boundary validation; structural
 * typing makes the two definitions interchangeable.
 *
 * Forward-compat: unknown `kind` values are ignored on apply (client-side),
 * so it's safe to extend the discriminated union without bumping version.
 */
export interface EditorEffectsState {
  version: 1;
  eraserTraces?: EraserTracePayload[];
  textSpans?: TextSpanMark[];
}

interface EraserTracePayload {
  rx: number;
  ry: number;
  w: number;
  h: number;
  chars: string[];
  intensity: number;
  seed: number;
}

type TextSpanMark =
  | {
      kind: 'time';
      start: number;
      end: number;
      mode: 'fontSize' | 'fontWeight';
      t: number;
      duration: number;
    }
  | { kind: 'pressure'; start: number; end: number; intensity: number; seed: number }
  | { kind: 'voice'; start: number; end: number; fontSizeEm: number };

export interface EntryProps {
  id: string;
  userId: string;
  content: string;
  mediaUrls: string[];
  fermentationEnabled: boolean;
  effects: EditorEffectsState | null;
  createdAt: string;
  updatedAt: string;
}

interface CreateEntryParams {
  userId: string;
  content: string;
  mediaUrls: string[];
  fermentationEnabled: boolean;
  effects?: EditorEffectsState | null;
}

const MAX_CONTENT_LENGTH = 100_000;

export class Entry {
  readonly id: string;
  readonly userId: string;
  readonly content: string;
  readonly mediaUrls: string[];
  readonly fermentationEnabled: boolean;
  readonly effects: EditorEffectsState | null;
  readonly createdAt: string;
  readonly updatedAt: string;

  private constructor(props: EntryProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.content = props.content;
    this.mediaUrls = props.mediaUrls;
    this.fermentationEnabled = props.fermentationEnabled;
    this.effects = props.effects;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(params: CreateEntryParams, generateId: () => string): Result<Entry, EntryError> {
    const validationError = Entry.validateContent(params.content);
    if (validationError) return err(validationError);

    const now = new Date().toISOString();
    return ok(
      new Entry({
        id: generateId(),
        userId: params.userId,
        content: params.content,
        mediaUrls: params.mediaUrls,
        fermentationEnabled: params.fermentationEnabled,
        effects: params.effects ?? null,
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
    effects?: EditorEffectsState | null,
  ): Result<Entry, EntryError> {
    const validationError = Entry.validateContent(content);
    if (validationError) return err(validationError);

    return ok(
      new Entry({
        ...this.toProps(),
        content,
        mediaUrls,
        effects: effects === undefined ? this.effects : effects,
        updatedAt: new Date().toISOString(),
      }),
    );
  }

  withFermentationEnabled(fermentationEnabled: boolean): Entry {
    return new Entry({
      ...this.toProps(),
      fermentationEnabled,
      updatedAt: new Date().toISOString(),
    });
  }

  toProps(): EntryProps {
    return {
      id: this.id,
      userId: this.userId,
      content: this.content,
      mediaUrls: this.mediaUrls,
      fermentationEnabled: this.fermentationEnabled,
      effects: this.effects,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  private static validateContent(content: string): EntryError | null {
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
