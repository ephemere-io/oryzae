import type { BoardCardRepositoryGateway } from '../../domain/gateways/board-card-repository.gateway.js';
import type { BoardSnippetRepositoryGateway } from '../../domain/gateways/board-snippet-repository.gateway.js';

export class DeleteBoardSnippetUsecase {
  constructor(
    private boardSnippetRepo: BoardSnippetRepositoryGateway,
    private boardCardRepo: BoardCardRepositoryGateway,
  ) {}

  async execute(snippetId: string, userId: string): Promise<void> {
    await this.boardCardRepo.deleteByRefId(snippetId, userId);
    await this.boardSnippetRepo.delete(snippetId);
  }
}
