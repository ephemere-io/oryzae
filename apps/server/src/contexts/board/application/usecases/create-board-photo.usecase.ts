import type { BoardCardRepositoryGateway } from '../../domain/gateways/board-card-repository.gateway.js';
import type { BoardPhotoRepositoryGateway } from '../../domain/gateways/board-photo-repository.gateway.js';
import type { BoardStorageGateway } from '../../domain/gateways/board-storage.gateway.js';
import { BoardCard } from '../../domain/models/board-card.js';
import { BoardPhoto } from '../../domain/models/board-photo.js';
import { BoardCardValidationError, BoardPhotoValidationError } from '../errors/board.errors.js';

interface CreateBoardPhotoInput {
  file: ArrayBuffer;
  fileName: string;
  contentType: string;
  caption: string;
  dateKey: string;
  viewType?: 'daily' | 'weekly';
}

interface CreateBoardPhotoResponse {
  photoId: string;
  cardId: string;
  imageUrl: string;
  caption: string;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  zIndex: number;
}

const DEFAULT_WIDTH = 200;
const DEFAULT_HEIGHT = 200;

export class CreateBoardPhotoUsecase {
  constructor(
    private boardPhotoRepo: BoardPhotoRepositoryGateway,
    private boardCardRepo: BoardCardRepositoryGateway,
    private boardStorage: BoardStorageGateway,
    private generateId: () => string,
  ) {}

  async execute(userId: string, input: CreateBoardPhotoInput): Promise<CreateBoardPhotoResponse> {
    // 1. Upload file to storage
    const storagePath = await this.boardStorage.upload(
      userId,
      input.fileName,
      input.file,
      input.contentType,
    );

    // 2. Create photo domain model
    const photoResult = BoardPhoto.create(
      { userId, storagePath, caption: input.caption },
      this.generateId,
    );
    if (!photoResult.success) {
      throw new BoardPhotoValidationError(photoResult.error.message);
    }
    const photo = photoResult.value;

    // 3. Create board card
    const x = Math.floor(Math.random() * 741) + 60;
    const y = Math.floor(Math.random() * 541) + 60;
    const rotation = Math.round((Math.random() * 10 - 5) * 10) / 10;
    const vt = input.viewType ?? 'daily';

    // New cards should appear on top of existing ones
    const maxZ = await this.boardCardRepo.findMaxZIndex(userId, input.dateKey, vt);

    const cardResult = BoardCard.create(
      {
        userId,
        cardType: 'photo',
        refId: photo.id,
        dateKey: input.dateKey,
        viewType: vt,
        x,
        y,
        rotation,
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        zIndex: maxZ + 1,
      },
      this.generateId,
    );
    if (!cardResult.success) {
      throw new BoardCardValidationError(cardResult.error.message);
    }
    const card = cardResult.value;

    // 4. Persist
    await this.boardPhotoRepo.save(photo);
    await this.boardCardRepo.saveMany([card]);

    const imageUrl = this.boardStorage.getPublicUrl(storagePath);

    return {
      photoId: photo.id,
      cardId: card.id,
      imageUrl,
      caption: photo.caption,
      x: card.x,
      y: card.y,
      rotation: card.rotation,
      width: card.width,
      height: card.height,
      zIndex: card.zIndex,
    };
  }
}
