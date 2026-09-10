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

/** いま壁に貼ってあるものの数（種類ごと）。 */
export interface PinnedCounts {
  snippet: number;
  photo: number;
}

export interface BoardCardRepositoryGateway {
  /**
   * その人のボードに貼ってあるカード全部（重なり順）。剥がしたカードは含めない。
   *
   * ボードは 1 人に 1 枚なので、日付でも表示単位でも絞らない。
   */
  findByUserId(userId: string): Promise<BoardCard[]>;
  /** 新しいカードを一番上に置くための、いまの最大の重なり順。カードが無ければ -1。 */
  findMaxZIndex(userId: string): Promise<number>;
  /**
   * 書斎の壁が読む「いま貼ってある量」（`docs/oryzae-study`）。
   *
   * 日記のカード（`entry`）は盤面に出さないのでここでも数えない。
   * 種類ごとに返すのは、書斎のホバーが「写真 3 件・スニペット 12 件」と名乗るため。
   * 総数だけだと「12 枚」としか言えず、**何が貼ってあるのかは開くまで分からない**。
   */
  countPinnedByType(userId: string): Promise<PinnedCounts>;
  /** 同じく書斎の壁用。新しい順に上限まで。 */
  findRecentByUserId(userId: string, limit: number): Promise<BoardCard[]>;
  save(card: BoardCard): Promise<void>;
  updatePositions(cards: CardPositionUpdate[]): Promise<void>;
  delete(id: string, userId: string): Promise<void>;
  deleteByRefId(refId: string, userId: string): Promise<void>;
}
