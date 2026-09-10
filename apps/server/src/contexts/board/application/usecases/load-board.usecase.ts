import type { BoardCardRepositoryGateway } from '../../domain/gateways/board-card-repository.gateway.js';
import type { BoardPhotoRepositoryGateway } from '../../domain/gateways/board-photo-repository.gateway.js';
import type { BoardSnippetRepositoryGateway } from '../../domain/gateways/board-snippet-repository.gateway.js';
import type { BoardStorageGateway } from '../../domain/gateways/board-storage.gateway.js';
import type { BoardCard } from '../../domain/models/board-card.js';
import { type CardResponse, hydrateBoardCards } from '../hydrate-board-cards.js';

interface LoadBoardResponse {
  cards: CardResponse[];
}

/**
 * ボードを開く。
 *
 * ボードは 1 人に 1 枚のコルクボードで、日付も表示単位（日次/週次）も持たない。
 * いつ貼ったものでも、貼ってあるものは全部ここに出る。
 */
export class LoadBoardUsecase {
  constructor(
    private boardCardRepo: BoardCardRepositoryGateway,
    private boardSnippetRepo: BoardSnippetRepositoryGateway,
    private boardPhotoRepo: BoardPhotoRepositoryGateway,
    private boardStorage: BoardStorageGateway,
  ) {}

  async execute(userId: string): Promise<LoadBoardResponse> {
    // 日記のカードは盤面に出さない。ボードは付箋（スニペット）と写真を貼る場所で、
    // 日記は瓶に漬け込むもの——という切り分けにした。以前に置かれた entry の行は
    // 消さずに残してあるので（復元できるように）、ここで読み飛ばす。
    const cards = LoadBoardUsecase.withoutEntries(await this.boardCardRepo.findByUserId(userId));

    return {
      cards: await hydrateBoardCards(
        {
          snippetRepo: this.boardSnippetRepo,
          photoRepo: this.boardPhotoRepo,
          storage: this.boardStorage,
        },
        cards,
      ),
    };
  }

  /** 盤面に出す対象から日記のカードを除く。行そのものは DB に残す。 */
  private static withoutEntries(cards: BoardCard[]): BoardCard[] {
    return cards.filter((c) => c.cardType !== 'entry');
  }
}
