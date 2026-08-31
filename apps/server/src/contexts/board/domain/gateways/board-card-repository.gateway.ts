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
  /**
   * いったん盤面から外された（soft delete された）カードを引く。
   *
   * board_cards は (user_id, ref_id, date_key, view_type) が一意で、外しても行は残る。
   * 同じものを置き直すときに新しい行を insert しようとすると一意制約に当たるため、
   * 「新規作成」ではなく「復活」で扱う必要がある。
   */
  findSoftDeletedByRefId(
    userId: string,
    refId: string,
    dateKey: string,
    viewType: string,
  ): Promise<BoardCard | null>;
  /** 外したカードを盤面へ戻す（is_deleted を落とし、重なり順だけ更新する）。 */
  restore(id: string, userId: string, zIndex: number): Promise<void>;
  findMaxZIndex(userId: string, dateKey: string, viewType: string): Promise<number>;
  saveMany(cards: BoardCard[]): Promise<void>;
  updatePositions(cards: CardPositionUpdate[]): Promise<void>;
  delete(id: string, userId: string): Promise<void>;
  deleteByRefId(refId: string, userId: string): Promise<void>;
}
