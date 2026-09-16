import type { NewsletterRepositoryGateway } from '../../domain/gateways/newsletter-repository.gateway.js';
import type { NewsletterProps } from '../../domain/models/newsletter.js';

const DEFAULT_LIMIT = 50;

export class ListNewslettersUsecase {
  constructor(private repository: NewsletterRepositoryGateway) {}

  async execute(limit = DEFAULT_LIMIT): Promise<NewsletterProps[]> {
    const newsletters = await this.repository.listRecent(limit);
    return newsletters.map((n) => n.toProps());
  }
}
