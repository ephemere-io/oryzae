import type { EntryRepositoryGateway } from '../../../entry/domain/gateways/entry-repository.gateway.js';
import type { EntryQuestionLinkRepositoryGateway } from '../../domain/gateways/entry-question-link-repository.gateway.js';
import type { QuestionRepositoryGateway } from '../../domain/gateways/question-repository.gateway.js';
import { QuestionNotFoundError } from '../errors/question.errors.js';

export class LinkQuestionToEntryUsecase {
  constructor(
    private linkRepo: EntryQuestionLinkRepositoryGateway,
    private questionRepo: QuestionRepositoryGateway,
    private entryRepo: EntryRepositoryGateway,
  ) {}

  async execute(entryId: string, questionId: string): Promise<void> {
    const entry = await this.entryRepo.findById(entryId);
    if (!entry) throw new Error(`Entry not found: ${entryId}`);

    const question = await this.questionRepo.findById(questionId);
    if (!question) throw new QuestionNotFoundError(questionId);

    await this.linkRepo.link(entryId, questionId);
  }
}
