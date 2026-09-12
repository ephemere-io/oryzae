import type { NewsletterRepositoryGateway } from '../../domain/gateways/newsletter-repository.gateway.js';
import type { NewsletterProps } from '../../domain/models/newsletter.js';
import { NewsletterNotFoundError } from '../errors/newsletter.errors.js';

export class GetNewsletterUsecase {
  constructor(private repository: NewsletterRepositoryGateway) {}

  async execute(id: string): Promise<NewsletterProps> {
    const newsletter = await this.repository.findById(id);
    if (!newsletter) throw new NewsletterNotFoundError(id);
    return newsletter.toProps();
  }
}
