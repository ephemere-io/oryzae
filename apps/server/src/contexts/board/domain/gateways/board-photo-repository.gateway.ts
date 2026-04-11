import type { BoardPhoto } from '../models/board-photo.js';

export interface BoardPhotoRepositoryGateway {
  findById(id: string): Promise<BoardPhoto | null>;
  findByIds(ids: string[]): Promise<BoardPhoto[]>;
  save(photo: BoardPhoto): Promise<void>;
  delete(id: string): Promise<void>;
}
