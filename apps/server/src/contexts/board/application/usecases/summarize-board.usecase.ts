import type { BoardCardRepositoryGateway } from '../../domain/gateways/board-card-repository.gateway.js';
import type { BoardPhotoRepositoryGateway } from '../../domain/gateways/board-photo-repository.gateway.js';
import type { BoardSnippetRepositoryGateway } from '../../domain/gateways/board-snippet-repository.gateway.js';
import type { BoardStorageGateway } from '../../domain/gateways/board-storage.gateway.js';
import { type CardResponse, hydrateBoardCards } from '../hydrate-board-cards.js';

export interface BoardSummary {
  /**
   * いま貼ってある総数。
   *
   * **`cards.length` とは別に返す。** 壁に描くのは上限までだが、「どのくらい溜まって
   * いるか」は本当の数で言いたい（棚が冊数を言うのと同じ）。
   */
  total: number;
  /** 内訳。書斎のホバーが「写真 3 件・スニペット 12 件」と名乗るのに使う。 */
  snippets: number;
  photos: number;
  /** 新しい順。上限まで。 */
  cards: CardResponse[];
}

/**
 * 書斎の壁が読む「いま貼ってあるもの」（`docs/oryzae-study`）。
 *
 * 書斎の壁は、ボードに溜まってきた量そのものを映す — 棚が冊数を、瓶が液面を映すのと
 * 同じ見立て。ボード自体が 1 人に 1 枚なので、ここも期間では絞らない。
 */
export class SummarizeBoardUsecase {
  constructor(
    private boardCardRepo: BoardCardRepositoryGateway,
    private boardSnippetRepo: BoardSnippetRepositoryGateway,
    private boardPhotoRepo: BoardPhotoRepositoryGateway,
    private boardStorage: BoardStorageGateway,
  ) {}

  async execute(userId: string, limit: number): Promise<BoardSummary> {
    const recent = await this.boardCardRepo.findRecentByUserId(userId, limit);

    const cards = await hydrateBoardCards(
      {
        snippetRepo: this.boardSnippetRepo,
        photoRepo: this.boardPhotoRepo,
        storage: this.boardStorage,
      },
      recent,
    );

    const counts = await this.boardCardRepo.countPinnedByType(userId);
    return {
      total: counts.snippet + counts.photo,
      snippets: counts.snippet,
      photos: counts.photo,
      cards,
    };
  }
}
