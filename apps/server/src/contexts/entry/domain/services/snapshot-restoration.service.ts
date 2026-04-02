import type { EntrySnapshot } from '../models/entry-snapshot';

/**
 * エディタスイッチ時の extension 復元判定。
 *
 * - 最新 snapshot の editorType が要求と一致 → extension を返す（復元可能）
 * - 一致しない or snapshot がない → null（エディタ側が新規初期化する）
 */
export function resolveExtension(
  latestSnapshot: EntrySnapshot | null,
  requestedEditorType: string,
): Record<string, unknown> | null {
  if (!latestSnapshot) return null;
  if (latestSnapshot.editorType === requestedEditorType) {
    return latestSnapshot.extension;
  }
  return null;
}
