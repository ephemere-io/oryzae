import { z } from 'zod';
import type {
  ChangelogSourceGateway,
  MergedPullRequest,
} from '../../domain/gateways/changelog-source.gateway.js';

/** 前回配信が無いとき（初回）に遡る日数。 */
const DEFAULT_LOOKBACK_DAYS = 30;
/** LLM に渡す PR 本文の上限。テンプレートやチェックリストで長くなりがちなので切る。 */
const MAX_BODY_LENGTH = 1500;
/** 1 回の生成で読む PR の上限。 */
const MAX_PULL_REQUESTS = 60;
const PER_PAGE = 100;
const MAX_PAGES = 3;

// GitHub のレスポンスは信用せず、必要な形だけを実行時に検証して取り出す。
const pullRequestSchema = z.object({
  number: z.number(),
  title: z.string(),
  html_url: z.string(),
  merged_at: z.string().nullable().optional(),
  updated_at: z.string().optional(),
  body: z.string().nullable().optional(),
});
const pullRequestListSchema = z.array(pullRequestSchema);

export class GithubChangelogUnavailableError extends Error {}

/**
 * merge 済み PR を「前回配信以降」で拾う。
 *
 * ## なぜ PR か
 *
 * コミットは粒度が細かすぎて（`fix: typo` が並ぶ）、リリースノートの素材に
 * ならない。このリポジトリは main への直接 push を禁じていて変更は必ず PR を
 * 通るので、PR のタイトルと本文が「何が変わったか」の一番良い粒度になる。
 *
 * ## トークンが要る
 *
 * private リポジトリなので `GITHUB_TOKEN`（repo 読み取り権限）が必要。
 * 未設定なら「使えない」ことを明示して落とす —— 空の結果を返すと
 * 「今回は変更が無かった」と区別できない。
 */
export class GithubChangelogSource implements ChangelogSourceGateway {
  async listMergedPullRequests(since: Date | null): Promise<MergedPullRequest[]> {
    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPO ?? 'ephemere-io/oryzae';

    if (!token) {
      throw new GithubChangelogUnavailableError(
        'GITHUB_TOKEN が未設定です。変更差分を読み取れないため下書きを生成できません。',
      );
    }

    const cutoff = since ?? new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

    const collected: MergedPullRequest[] = [];

    // closed を updated 降順で辿り、merged_at が cutoff を下回ったら打ち切る。
    // GitHub の pulls API は merged_at で絞り込めないため、この形になる。
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url =
        `https://api.github.com/repos/${repo}/pulls` +
        `?state=closed&sort=updated&direction=desc&per_page=${PER_PAGE}&page=${page}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'Oryzae/1.0 (https://github.com/ephemere-io/oryzae)',
        },
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new GithubChangelogUnavailableError(
          `GitHub API ${response.status}: ${body.slice(0, 200)}`,
        );
      }

      const parsed = pullRequestListSchema.safeParse(await response.json());
      if (!parsed.success) {
        throw new GithubChangelogUnavailableError('GitHub API の応答が想定の形ではありません');
      }
      if (parsed.data.length === 0) break;

      let reachedCutoff = false;
      for (const pr of parsed.data) {
        if (!pr.merged_at) continue;
        const mergedAt = new Date(pr.merged_at);
        if (mergedAt.getTime() <= cutoff.getTime()) {
          // updated 降順なので、merged_at も概ね降順。ただし「古い PR が後から
          // コメントで更新される」ことがあるので、1 件見ただけでは止めない。
          reachedCutoff = true;
          continue;
        }
        collected.push({
          number: pr.number,
          title: pr.title,
          mergedAt: pr.merged_at,
          body: (pr.body ?? '').slice(0, MAX_BODY_LENGTH),
          url: pr.html_url,
        });
      }

      if (collected.length >= MAX_PULL_REQUESTS) break;
      // このページが全部 cutoff より古ければ、さらに遡る意味はない。
      if (reachedCutoff && collected.length === 0 && page > 1) break;
      if (parsed.data.length < PER_PAGE) break;
    }

    return collected
      .sort((a, b) => new Date(b.mergedAt).getTime() - new Date(a.mergedAt).getTime())
      .slice(0, MAX_PULL_REQUESTS);
  }
}
