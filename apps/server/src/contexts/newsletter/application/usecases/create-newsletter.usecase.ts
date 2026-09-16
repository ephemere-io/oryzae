import type { NewsletterRepositoryGateway } from '../../domain/gateways/newsletter-repository.gateway.js';
import { Newsletter, type NewsletterProps } from '../../domain/models/newsletter.js';
import { NewsletterValidationError } from '../errors/newsletter.errors.js';

interface CreateNewsletterInput {
  subject: string;
  bodyMarkdown: string;
  /** 書いた admin の user_id。 */
  createdBy: string;
}

export class CreateNewsletterUsecase {
  constructor(
    private repository: NewsletterRepositoryGateway,
    private generateId: () => string,
  ) {}

  async execute(input: CreateNewsletterInput): Promise<NewsletterProps> {
    const result = Newsletter.create(
      {
        subject: input.subject,
        bodyMarkdown: input.bodyMarkdown,
        createdBy: input.createdBy,
      },
      this.generateId,
    );
    if (!result.success) throw new NewsletterValidationError(result.error.message);

    await this.repository.save(result.value);
    return result.value.toProps();
  }
}
