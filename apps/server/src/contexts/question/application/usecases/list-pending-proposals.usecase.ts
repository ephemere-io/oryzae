import type { QuestionRepositoryGateway } from '../../domain/gateways/question-repository.gateway.js';
import type { QuestionTransactionRepositoryGateway } from '../../domain/gateways/question-transaction-repository.gateway.js';
import type { QuestionProps } from '../../domain/models/question.js';

interface PendingProposal {
  question: QuestionProps;
  proposedText: string;
  currentText: string | null;
  proposalType: 'new' | 'update';
}

export class ListPendingProposalsUsecase {
  constructor(
    private questionRepo: QuestionRepositoryGateway,
    private transactionRepo: QuestionTransactionRepositoryGateway,
  ) {}

  async execute(userId: string): Promise<PendingProposal[]> {
    const results: PendingProposal[] = [];

    // New question proposals (question itself is unvalidated)
    const pendingQuestions = await this.questionRepo.listPendingByUserId(userId);
    for (const q of pendingQuestions) {
      const tx = await this.transactionRepo.findLatestByQuestionId(q.id);
      if (tx) {
        results.push({
          question: q.toProps(),
          proposedText: tx.string,
          currentText: null,
          proposalType: 'new',
        });
      }
    }

    // Text update proposals (question is validated, but has unvalidated transaction)
    const activeQuestions = await this.questionRepo.listActiveByUserId(userId);
    for (const q of activeQuestions) {
      const unvalidatedTx = await this.transactionRepo.findLatestUnvalidatedByQuestionId(q.id);
      if (unvalidatedTx) {
        const currentTx = await this.transactionRepo.findLatestValidatedByQuestionId(q.id);
        results.push({
          question: q.toProps(),
          proposedText: unvalidatedTx.string,
          currentText: currentTx?.string ?? null,
          proposalType: 'update',
        });
      }
    }

    return results;
  }
}
