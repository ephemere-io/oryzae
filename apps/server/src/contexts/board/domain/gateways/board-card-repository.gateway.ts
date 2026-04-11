import type { BoardCard } from '../models/board-card.js';

export interface CardPositionUpdate {
  id: string;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  zIndex: number;
}

export interface BoardCardRepositoryGateway {
  findByDateAndView(userId: string, dateKey: string, viewType: string): Promise<BoardCard[]>;
  findRefIdsByDateAndView(
    userId: string,
    dateKey: string,
    viewType: string,
    cardType: string,
  ): Promise<string[]>;
  saveMany(cards: BoardCard[]): Promise<void>;
  updatePositions(cards: CardPositionUpdate[]): Promise<void>;
  delete(id: string, userId: string): Promise<void>;
  deleteByRefId(refId: string, userId: string): Promise<void>;
}
