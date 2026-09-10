import type { BoardCard } from '../models/board-card.js';

export interface CardPositionUpdate {
  id: string;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  zIndex: number;
  /** 利用者が自分で動かしたカードか。未指定なら既存値を変えない。 */
  userPositioned?: boolean;
}

export interface BoardCardRepositoryGateway {
  findByDateAndView(userId: string, dateKey: string, viewType: string): Promise<BoardCard[]>;
  findDailyCardsByDateRange(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<BoardCard[]>;
  findRefIdsByDateAndView(
    userId: string,
    dateKey: string,
    viewType: string,
    cardType: string,
  ): Promise<string[]>;
  findRefIdsByDateRange(
    userId: string,
    startDate: string,
    endDate: string,
    cardType: string,
  ): Promise<string[]>;
  findSoftDeletedRefIdsByDateAndView(
    userId: string,
    dateKey: string,
    viewType: string,
  ): Promise<string[]>;
  findMaxZIndex(userId: string, dateKey: string, viewType: string): Promise<number>;
  /**
   * 書斎の壁が読む「いま貼ってある量」（`docs/oryzae-study`）。
   *
   * **日付では絞らない。** 書斎は 1 日の盤面ではなく、溜まってきた総量を映す
   * （棚の冊数・瓶の液面と同じ見立て）。日記のカード（`entry`）は盤面に出さないので
   * ここでも数えない。
   */
  countByUserId(userId: string): Promise<number>;
  /** 同じく書斎の壁用。新しい順に上限まで。 */
  findRecentByUserId(userId: string, limit: number): Promise<BoardCard[]>;
  saveMany(cards: BoardCard[]): Promise<void>;
  updatePositions(cards: CardPositionUpdate[]): Promise<void>;
  delete(id: string, userId: string): Promise<void>;
  deleteByRefId(refId: string, userId: string): Promise<void>;
}
