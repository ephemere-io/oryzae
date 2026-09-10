import type { BoardCardRepositoryGateway } from '../../domain/gateways/board-card-repository.gateway.js';
import type { BoardPhotoRepositoryGateway } from '../../domain/gateways/board-photo-repository.gateway.js';
import type { BoardSnippetRepositoryGateway } from '../../domain/gateways/board-snippet-repository.gateway.js';
import type { BoardStorageGateway } from '../../domain/gateways/board-storage.gateway.js';
import { BoardCard } from '../../domain/models/board-card.js';
import { type CardResponse, hydrateBoardCards } from '../hydrate-board-cards.js';

interface LoadBoardResponse {
  dateKey: string;
  viewType: string;
  cards: CardResponse[];
}

export class LoadBoardUsecase {
  constructor(
    private boardCardRepo: BoardCardRepositoryGateway,
    private boardSnippetRepo: BoardSnippetRepositoryGateway,
    private boardPhotoRepo: BoardPhotoRepositoryGateway,
    private boardStorage: BoardStorageGateway,
    private generateId: () => string,
  ) {}

  async execute(
    userId: string,
    dateKey: string,
    viewType: 'daily' | 'weekly' = 'daily',
    // tzOffset は受け取らない。日付でエントリを引くのをやめたため、ここに暦日の
    // 判定は残っていない。
  ): Promise<LoadBoardResponse> {
    // 1. Load existing cards
    //
    // 日記のカードは盤面に出さない。ボードは付箋（スニペット）と写真を貼る場所で、
    // 日記は瓶に漬け込むもの——という切り分けにした。以前に置かれた entry の行は
    // 消さずに残してあるので（復元できるように）、ここで読み飛ばす。
    let existingCards = LoadBoardUsecase.withoutEntries(
      await this.boardCardRepo.findByDateAndView(userId, dateKey, viewType),
    );

    // For weekly view, also include daily cards from the same week
    if (viewType === 'weekly') {
      const { startDate, endDate } = LoadBoardUsecase.weekRange(dateKey);
      const dailyCards = LoadBoardUsecase.withoutEntries(
        await this.boardCardRepo.findDailyCardsByDateRange(userId, startDate, endDate),
      );
      // Exclude daily cards whose refIds were soft-deleted in weekly view
      const deletedWeeklyRefIds = await this.boardCardRepo.findSoftDeletedRefIdsByDateAndView(
        userId,
        dateKey,
        viewType,
      );
      const deletedWeeklySet = new Set(deletedWeeklyRefIds);
      // Merge, avoiding duplicates by refId+cardType and excluding soft-deleted weekly cards
      const existingKeys = new Set(existingCards.map((c) => `${c.cardType}:${c.refId}`));
      const uniqueDailyCards = dailyCards.filter(
        (c) => !existingKeys.has(`${c.cardType}:${c.refId}`) && !deletedWeeklySet.has(c.refId),
      );
      // Create weekly copies of daily cards so positions are independent per view
      const weeklyCopies: BoardCard[] = [];
      for (const dailyCard of uniqueDailyCards) {
        const result = BoardCard.create(
          {
            userId,
            cardType: dailyCard.cardType,
            refId: dailyCard.refId,
            dateKey,
            viewType: 'weekly',
            x: dailyCard.x,
            y: dailyCard.y,
            rotation: dailyCard.rotation,
            width: dailyCard.width,
            height: dailyCard.height,
            zIndex: existingCards.length + weeklyCopies.length,
          },
          this.generateId,
        );
        if (result.success) {
          weeklyCopies.push(result.value);
        }
      }
      if (weeklyCopies.length > 0) {
        await this.boardCardRepo.saveMany(weeklyCopies);
      }
      existingCards = [...existingCards, ...weeklyCopies];
    }

    const allCards = existingCards;

    // 3. Hydrate content
    const cardResponses = await hydrateBoardCards(
      {
        snippetRepo: this.boardSnippetRepo,
        photoRepo: this.boardPhotoRepo,
        storage: this.boardStorage,
      },
      allCards,
    );

    return { dateKey, viewType, cards: cardResponses };
  }

  /** 盤面に出す対象から日記のカードを除く。行そのものは DB に残す。 */
  private static withoutEntries(cards: BoardCard[]): BoardCard[] {
    return cards.filter((c) => c.cardType !== 'entry');
  }

  private static weekRange(dateKey: string): { startDate: string; endDate: string } {
    const d = new Date(`${dateKey}T00:00:00`);
    const day = d.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const fmt = (dt: Date) => {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };

    return { startDate: fmt(monday), endDate: fmt(sunday) };
  }
}
