export interface EntrySnapshotProps {
  id: string;
  entryId: string;
  content: string;
  editorType: string;
  editorVersion: string;
  extension: Record<string, unknown>;
  createdAt: string;
}

interface CreateEntrySnapshotParams {
  entryId: string;
  content: string;
  editorType: string;
  editorVersion: string;
  extension: Record<string, unknown>;
}

export class EntrySnapshot {
  readonly id: string;
  readonly entryId: string;
  readonly content: string;
  readonly editorType: string;
  readonly editorVersion: string;
  readonly extension: Record<string, unknown>;
  readonly createdAt: string;

  private constructor(props: EntrySnapshotProps) {
    this.id = props.id;
    this.entryId = props.entryId;
    this.content = props.content;
    this.editorType = props.editorType;
    this.editorVersion = props.editorVersion;
    this.extension = props.extension;
    this.createdAt = props.createdAt;
  }

  static create(params: CreateEntrySnapshotParams, generateId: () => string): EntrySnapshot {
    return new EntrySnapshot({
      id: generateId(),
      entryId: params.entryId,
      content: params.content,
      editorType: params.editorType,
      editorVersion: params.editorVersion,
      extension: params.extension,
      createdAt: new Date().toISOString(),
    });
  }

  static fromProps(props: EntrySnapshotProps): EntrySnapshot {
    return new EntrySnapshot(props);
  }

  toProps(): EntrySnapshotProps {
    return {
      id: this.id,
      entryId: this.entryId,
      content: this.content,
      editorType: this.editorType,
      editorVersion: this.editorVersion,
      extension: this.extension,
      createdAt: this.createdAt,
    };
  }
}
