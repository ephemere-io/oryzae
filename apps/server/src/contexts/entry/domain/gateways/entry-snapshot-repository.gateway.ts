import type { EntrySnapshot } from '../models/entry-snapshot.js';

export interface EntrySnapshotRepositoryGateway {
  /**
   * entry_snapshots に1行追記（immutable append-only）。
   */
  append(snapshot: EntrySnapshot): Promise<void>;

  /**
   * entry_snapshots から最新の1行を取得。
   * エディタスイッチ判定に使う。
   */
  findLatestByEntryId(entryId: string): Promise<EntrySnapshot | null>;
}
