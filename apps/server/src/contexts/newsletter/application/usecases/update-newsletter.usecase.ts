import type { NewsletterRepositoryGateway } from '../../domain/gateways/newsletter-repository.gateway.js';
import type { NewsletterProps } from '../../domain/models/newsletter.js';
import { NewsletterNotFoundError, NewsletterValidationError } from '../errors/newsletter.errors.js';

interface UpdateNewsletterInput {
  id: string;
  subject: string;
  bodyMarkdown: string;
}

export class UpdateNewsletterUsecase {
  constructor(private repository: NewsletterRepositoryGateway) {}

  async execute(input: UpdateNewsletterInput): Promise<NewsletterProps> {
    const newsletter = await this.repository.findById(input.id);
    if (!newsletter) throw new NewsletterNotFoundError(input.id);

    const result = newsletter.withContent({
      subject: input.subject,
      bodyMarkdown: input.bodyMarkdown,
    });
    if (!result.success) throw new NewsletterValidationError(result.error.message);

    await this.repository.save(result.value);
    return result.value.toProps();
  }
}
