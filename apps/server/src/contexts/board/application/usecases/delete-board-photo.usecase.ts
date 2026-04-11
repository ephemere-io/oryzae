import type { BoardCardRepositoryGateway } from '../../domain/gateways/board-card-repository.gateway.js';
import type { BoardPhotoRepositoryGateway } from '../../domain/gateways/board-photo-repository.gateway.js';
import type { BoardStorageGateway } from '../../domain/gateways/board-storage.gateway.js';
import { BoardPhotoNotFoundError } from '../errors/board.errors.js';

export class DeleteBoardPhotoUsecase {
  constructor(
    private boardPhotoRepo: BoardPhotoRepositoryGateway,
    private boardCardRepo: BoardCardRepositoryGateway,
    private boardStorage: BoardStorageGateway,
  ) {}

  async execute(photoId: string, userId: string): Promise<void> {
    const photo = await this.boardPhotoRepo.findById(photoId);
    if (!photo) throw new BoardPhotoNotFoundError(photoId);

    await this.boardCardRepo.deleteByRefId(photoId, userId);
    await this.boardPhotoRepo.delete(photoId);
    await this.boardStorage.delete(photo.storagePath);
  }
}
