export interface MergedPullRequest {
  number: number;
  title: string;
  /** ISO 8601。マージされた時刻。 */
  mergedAt: string;
  /** PR 本文。長いものは infrastructure 側で切り詰めて渡す。 */
  body: string;
  url: string;
}

/**
 * 「前回配信から今までに何が変わったか」の素材。
 *
 * 実装は GitHub の merged PR を読むが、domain はそれを知らない。
 * 素材の出所を差し替えても（CHANGELOG ファイル、リリースノート）
 * 下書き生成のユースケースは変わらない。
 */
export interface ChangelogSourceGateway {
  /** `since` 以降にマージされた PR を新しい順で返す。`since` が null なら直近ぶん。 */
  listMergedPullRequests(since: Date | null): Promise<MergedPullRequest[]>;
}
