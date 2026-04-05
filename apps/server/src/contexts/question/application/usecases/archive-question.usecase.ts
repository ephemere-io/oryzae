import type { QuestionRepositoryGateway } from '../../domain/gateways/question-repository.gateway.js';
import type { QuestionProps } from '../../domain/models/question.js';
import { QuestionNotFoundError } from '../errors/question.errors.js';

export class ArchiveQuestionUsecase {
  constructor(private questionRepo: QuestionRepositoryGateway) {}

  async execute(questionId: string): Promise<QuestionProps> {
    const question = await this.questionRepo.findById(questionId);
    if (!question) throw new QuestionNotFoundError(questionId);

    const archived = question.withArchived();
    await this.questionRepo.save(archived);

    return archived.toProps();
  }
}
