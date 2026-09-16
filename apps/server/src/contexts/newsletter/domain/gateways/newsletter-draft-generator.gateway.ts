import type { MergedPullRequest } from './changelog-source.gateway.js';

export interface NewsletterDraftRequest {
  pullRequests: MergedPullRequest[];
  /** 前回配信の時刻（ISO 8601）。初回は null。 */
  since: string | null;
  /** 直近に送った件名。同じ書き出しが続かないように渡す。 */
  previousSubjects: string[];
}

export interface NewsletterDraftSuggestion {
  subject: string;
  bodyMarkdown: string;
}

export interface NewsletterDraftGeneratorGateway {
  generate(request: NewsletterDraftRequest): Promise<NewsletterDraftSuggestion>;
}
