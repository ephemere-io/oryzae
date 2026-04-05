import type { EntryQuestionLinkRepositoryGateway } from '../../domain/gateways/entry-question-link-repository.gateway.js';

export class UnlinkQuestionFromEntryUsecase {
  constructor(private linkRepo: EntryQuestionLinkRepositoryGateway) {}

  async execute(entryId: string, questionId: string): Promise<void> {
    await this.linkRepo.unlink(entryId, questionId);
  }
}
