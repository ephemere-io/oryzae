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
    const cards = LoadBoardUsecase.dedupeByRef(
      LoadBoardUsecase.withoutEntries(await this.boardCardRepo.findByUserId(userId)),
    );

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

  /**
   * 同じ付箋・写真は 1 枚だけ出す。
   *
   * ボードが日付ごと・日次/週次ごとに分かれていたころは、**同じ付箋が複数の盤面に
   * 1 行ずつ**置かれていた（週次は開くたびに日次からコピーしていた）。00026 でその行を
   * 畳むが、**流す前でも同じ写真が 2〜3 枚に見えてはいけない**ので、ここでも畳む。
   * 畳まないと、1 枚消したときに実体（写真）ごと消えて残りが 404 になり、
   * 「消したのに戻ってきた」ように見える。
   *
   * どれを残すかは 00026 と同じ規準: 利用者が自分で置いた行 → 最後に触った行。
   */
  private static dedupeByRef(cards: BoardCard[]): BoardCard[] {
    const bestByRef = new Map<string, BoardCard>();
    for (const card of cards) {
      const current = bestByRef.get(card.refId);
      if (current === undefined || LoadBoardUsecase.isPreferred(card, current)) {
        bestByRef.set(card.refId, card);
      }
    }
    return [...bestByRef.values()];
  }

  private static isPreferred(candidate: BoardCard, current: BoardCard): boolean {
    if (candidate.userPositioned !== current.userPositioned) return candidate.userPositioned;
    return candidate.updatedAt > current.updatedAt;
  }
}
