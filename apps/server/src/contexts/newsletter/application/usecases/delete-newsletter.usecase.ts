import type { NewsletterRepositoryGateway } from '../../domain/gateways/newsletter-repository.gateway.js';
import { NewsletterNotFoundError, NewsletterValidationError } from '../errors/newsletter.errors.js';

/**
 * 下書きの削除。
 *
 * 送信済みは消せない。「誰に何を送ったか」は後から問い合わせを受ける対象で、
 * 履歴が消せると答えられなくなる。
 */
export class DeleteNewsletterUsecase {
  constructor(private repository: NewsletterRepositoryGateway) {}

  async execute(id: string): Promise<void> {
    const newsletter = await this.repository.findById(id);
    if (!newsletter) throw new NewsletterNotFoundError(id);
    if (!newsletter.isEditable) {
      throw new NewsletterValidationError('送信済み（または送信中）の配信は削除できません');
    }
    await this.repository.delete(id);
  }
}
