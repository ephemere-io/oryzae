import type { BoardCardRepositoryGateway } from '../../domain/gateways/board-card-repository.gateway.js';
import type { BoardPhotoRepositoryGateway } from '../../domain/gateways/board-photo-repository.gateway.js';
import type { BoardSnippetRepositoryGateway } from '../../domain/gateways/board-snippet-repository.gateway.js';
import type { BoardStorageGateway } from '../../domain/gateways/board-storage.gateway.js';
import { type CardResponse, hydrateBoardCards } from '../hydrate-board-cards.js';

export interface BoardSummary {
  /**
   * いま貼ってある総数（全期間・全 view）。
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
 * **日付で絞らない。** 盤面（`/board`）は 1 日・1 週の作業場だが、書斎の壁はそこに
 * 溜まってきた量そのものを映す — 棚が冊数を、瓶が液面を映すのと同じ見立て。当日の
 * daily だけを映していたころは、その日に何も貼っていなければ壁が空で、**使っている
 * 人の壁ほど空に見える**という逆の絵になっていた。
 *
 * 同じ付箋が daily と weekly の両方に居ることがある。壁では二重に見えても構わない
 * ものではないので、**`refId` で畳んでから**返す（数えるほうも同じ基準にする）。
 */
export class SummarizeBoardUsecase {
  constructor(
    private boardCardRepo: BoardCardRepositoryGateway,
    private boardSnippetRepo: BoardSnippetRepositoryGateway,
    private boardPhotoRepo: BoardPhotoRepositoryGateway,
    private boardStorage: BoardStorageGateway,
  ) {}

  async execute(userId: string, limit: number): Promise<BoardSummary> {
    // 畳むぶん多めに取る。上限ちょうどだけ引くと、重複が多い人は壁が薄くなる。
    const raw = await this.boardCardRepo.findRecentByUserId(userId, limit * 2);

    const seen = new Set<string>();
    const unique = raw.filter((card) => {
      const key = `${card.cardType}:${card.refId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const cards = await hydrateBoardCards(
      {
        snippetRepo: this.boardSnippetRepo,
        photoRepo: this.boardPhotoRepo,
        storage: this.boardStorage,
      },
      unique.slice(0, limit),
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
