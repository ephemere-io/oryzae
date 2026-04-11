import type { BoardSnippetRepositoryGateway } from '../../domain/gateways/board-snippet-repository.gateway.js';
import { BoardSnippetNotFoundError, BoardSnippetValidationError } from '../errors/board.errors.js';

export class UpdateBoardSnippetUsecase {
  constructor(private boardSnippetRepo: BoardSnippetRepositoryGateway) {}

  async execute(snippetId: string, text: string): Promise<void> {
    const snippet = await this.boardSnippetRepo.findById(snippetId);
    if (!snippet) {
      throw new BoardSnippetNotFoundError(snippetId);
    }

    const result = snippet.withText(text);
    if (!result.success) {
      throw new BoardSnippetValidationError(result.error.message);
    }

    await this.boardSnippetRepo.update(result.value);
  }
}
