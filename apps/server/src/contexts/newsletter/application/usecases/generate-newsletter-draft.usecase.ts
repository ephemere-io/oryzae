import type { ChangelogSourceGateway } from '../../domain/gateways/changelog-source.gateway.js';
import type { NewsletterDraftGeneratorGateway } from '../../domain/gateways/newsletter-draft-generator.gateway.js';
import type { NewsletterRepositoryGateway } from '../../domain/gateways/newsletter-repository.gateway.js';
import { Newsletter, type NewsletterProps } from '../../domain/models/newsletter.js';
import {
  NewsletterNoChangesError,
  NewsletterValidationError,
} from '../errors/newsletter.errors.js';

export interface GenerateNewsletterDraftResult {
  newsletter: NewsletterProps;
  /** 素材にした PR の件数と起点。画面に「何を読んで書いたか」を出すため。 */
  source: {
    since: string | null;
    pullRequestCount: number;
    pullRequests: Array<{ number: number; title: string; url: string }>;
  };
}

/**
 * 前回配信から今までの変更を読んで下書きを作る (issue #614)。
 *
 * 起点は「直近に送信し終えた配信の sent_at」。初回は null になり、
 * changelog 側が既定の期間（直近ぶん）を返す。
 *
 * 生成物は必ず **下書きとして保存する**。その場で画面に出すだけにすると、
 * 気に入らなくて閉じたときに LLM の実費だけが消える。
 */
export class GenerateNewsletterDraftUsecase {
  constructor(
    private repository: NewsletterRepositoryGateway,
    private changelog: ChangelogSourceGateway,
    private generator: NewsletterDraftGeneratorGateway,
    private generateId: () => string,
  ) {}

  async execute(params: { createdBy: string }): Promise<GenerateNewsletterDraftResult> {
    const lastSent = await this.repository.findLastSent();
    const since = lastSent?.sentAt ?? null;

    const pullRequests = await this.changelog.listMergedPullRequests(
      since ? new Date(since) : null,
    );
    // 素材ゼロで LLM に書かせると、それらしい嘘のリリースノートが出てくる。
    if (pullRequests.length === 0) throw new NewsletterNoChangesError(since);

    const recent = await this.repository.listRecent(5);
    const suggestion = await this.generator.generate({
      pullRequests,
      since,
      previousSubjects: recent.map((n) => n.subject),
    });

    const created = Newsletter.create(
      {
        subject: suggestion.subject,
        bodyMarkdown: suggestion.bodyMarkdown,
        createdBy: params.createdBy,
      },
      this.generateId,
    );
    if (!created.success) throw new NewsletterValidationError(created.error.message);

    await this.repository.save(created.value);

    return {
      newsletter: created.value.toProps(),
      source: {
        since,
        pullRequestCount: pullRequests.length,
        pullRequests: pullRequests.map((pr) => ({
          number: pr.number,
          title: pr.title,
          url: pr.url,
        })),
      },
    };
  }
}
