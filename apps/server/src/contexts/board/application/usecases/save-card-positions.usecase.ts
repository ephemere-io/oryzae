import type {
  BoardCardRepositoryGateway,
  CardPositionUpdate,
} from '../../domain/gateways/board-card-repository.gateway.js';
import { BoardCardValidationError } from '../errors/board.errors.js';

const MIN_SIZE = 120;

export class SaveCardPositionsUsecase {
  constructor(private boardCardRepo: BoardCardRepositoryGateway) {}

  async execute(cards: CardPositionUpdate[]): Promise<void> {
    for (const card of cards) {
      if (card.width < MIN_SIZE || card.height < MIN_SIZE) {
        throw new BoardCardValidationError(`Card dimensions must be at least ${MIN_SIZE}px`);
      }
    }
    await this.boardCardRepo.updatePositions(cards);
  }
}
