import type { BoardCardRepositoryGateway } from '../../domain/gateways/board-card-repository.gateway.js';
import type { BoardSnippetRepositoryGateway } from '../../domain/gateways/board-snippet-repository.gateway.js';
import { BoardCard } from '../../domain/models/board-card.js';
import { BoardSnippet } from '../../domain/models/board-snippet.js';
import { BoardCardValidationError, BoardSnippetValidationError } from '../errors/board.errors.js';

interface CreateBoardSnippetInput {
  text: string;
  dateKey: string;
  viewType?: 'daily' | 'weekly';
}

interface CreateBoardSnippetResponse {
  snippetId: string;
  cardId: string;
  text: string;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  zIndex: number;
}

const DEFAULT_WIDTH = 260;
const DEFAULT_HEIGHT = 150;

export class CreateBoardSnippetUsecase {
  constructor(
    private boardSnippetRepo: BoardSnippetRepositoryGateway,
    private boardCardRepo: BoardCardRepositoryGateway,
    private generateId: () => string,
  ) {}

  async execute(
    userId: string,
    input: CreateBoardSnippetInput,
  ): Promise<CreateBoardSnippetResponse> {
    const snippetResult = BoardSnippet.create({ userId, text: input.text }, this.generateId);
    if (!snippetResult.success) {
      throw new BoardSnippetValidationError(snippetResult.error.message);
    }
    const snippet = snippetResult.value;

    const x = Math.floor(Math.random() * 741) + 60;
    const y = Math.floor(Math.random() * 541) + 60;
    const rotation = Math.round((Math.random() * 10 - 5) * 10) / 10;

    const cardResult = BoardCard.create(
      {
        userId,
        cardType: 'snippet',
        refId: snippet.id,
        dateKey: input.dateKey,
        viewType: input.viewType ?? 'daily',
        x,
        y,
        rotation,
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        zIndex: 0,
      },
      this.generateId,
    );
    if (!cardResult.success) {
      throw new BoardCardValidationError(cardResult.error.message);
    }
    const card = cardResult.value;

    await this.boardSnippetRepo.save(snippet);
    await this.boardCardRepo.saveMany([card]);

    return {
      snippetId: snippet.id,
      cardId: card.id,
      text: snippet.text,
      x: card.x,
      y: card.y,
      rotation: card.rotation,
      width: card.width,
      height: card.height,
      zIndex: card.zIndex,
    };
  }
}
