import type { QuestionRepositoryGateway } from '../../domain/gateways/question-repository.gateway';
import type { QuestionProps } from '../../domain/models/question';
import { QuestionLimitExceededError, QuestionNotFoundError } from '../errors/question.errors';

export class UnarchiveQuestionUsecase {
  constructor(private questionRepo: QuestionRepositoryGateway) {}

  async execute(questionId: string): Promise<QuestionProps> {
    const question = await this.questionRepo.findById(questionId);
    if (!question) throw new QuestionNotFoundError(questionId);

    const activeCount = await this.questionRepo.countActiveByUserId(question.userId);
    if (activeCount >= 3) throw new QuestionLimitExceededError();

    const unarchived = question.withUnarchived();
    await this.questionRepo.save(unarchived);

    return unarchived.toProps();
  }
}
