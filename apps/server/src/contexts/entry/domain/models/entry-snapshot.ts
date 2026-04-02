export interface EntrySnapshot {
  id: string;
  entryId: string;
  content: string;
  editorType: string;
  editorVersion: string;
  extension: Record<string, unknown>;
  createdAt: string;
}
