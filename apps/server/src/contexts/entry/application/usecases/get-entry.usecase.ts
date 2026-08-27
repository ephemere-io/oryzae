import type { EntryRepositoryGateway } from '../../domain/gateways/entry-repository.gateway.js';
import type { EntrySnapshotRepositoryGateway } from '../../domain/gateways/entry-snapshot-repository.gateway.js';
import type { EntryStorageGateway } from '../../domain/gateways/entry-storage.gateway.js';
import type { EntryProps } from '../../domain/models/entry.js';
import type { EntrySnapshotProps } from '../../domain/models/entry-snapshot.js';

interface GetEntryResult {
  entry: EntryProps;
  latestSnapshot: EntrySnapshotProps | null;
  /**
   * `entry.mediaUrls` のストレージパスに対応する表示用 URL。
   * バケットが private なので都度署名する。1 時間で失効するため保存してはいけない。
   *
   * **`mediaUrls` と必ず同じ長さ・同じ並びで返す。** 署名に失敗した写真は空文字で
   * 穴を維持する（詰めない）。詰めると index がずれ、クライアントが「n 番目を削除」
   * したときに別の写真を消してしまうため。
   */
  mediaSignedUrls: string[];
}

export class GetEntryUsecase {
  constructor(
    private entryRepo: EntryRepositoryGateway,
    private snapshotRepo: EntrySnapshotRepositoryGateway,
    private entryStorage: EntryStorageGateway,
  ) {}

  async execute(entryId: string): Promise<GetEntryResult | null> {
    const entry = await this.entryRepo.findById(entryId);
    if (!entry) return null;

    const latestSnapshot = await this.snapshotRepo.findLatestByEntryId(entryId);
    const props = entry.toProps();

    const signed = await this.entryStorage.getSignedUrls(props.mediaUrls);
    // 署名できなかったパスは空文字で埋める。filter で詰めてはいけない（index がずれる）。
    const mediaSignedUrls = props.mediaUrls.map((path) => signed.get(path) ?? '');

    return {
      entry: props,
      latestSnapshot: latestSnapshot?.toProps() ?? null,
      mediaSignedUrls,
    };
  }
}
