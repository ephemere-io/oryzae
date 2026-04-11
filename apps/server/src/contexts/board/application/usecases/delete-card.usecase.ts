import type { BoardCardRepositoryGateway } from '../../domain/gateways/board-card-repository.gateway.js';

export class DeleteCardUsecase {
  constructor(private boardCardRepo: BoardCardRepositoryGateway) {}

  async execute(cardId: string, userId: string): Promise<void> {
    await this.boardCardRepo.delete(cardId, userId);
  }
}
