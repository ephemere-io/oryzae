import type { EntrySnapshot } from '../models/entry-snapshot';
import { type Result, ok, err } from '../../../shared/domain/types/result';

export type SnapshotRestorationError = 'no-snapshot' | 'editor-mismatch';

/**
 * エディタスイッチ時の extension 復元判定。
 *
 * - 最新 snapshot の editorType が要求と一致 → extension を返す（復元可能）
 * - 一致しない → editor-mismatch
 * - snapshot がない → no-snapshot
 */
export function resolveExtension(
  latestSnapshot: EntrySnapshot | null,
  requestedEditorType: string,
): Result<Record<string, unknown>, SnapshotRestorationError> {
  if (!latestSnapshot) {
    return err('no-snapshot');
  }
  if (latestSnapshot.editorType !== requestedEditorType) {
    return err('editor-mismatch');
  }
  return ok(latestSnapshot.extension);
}
