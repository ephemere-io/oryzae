import { err, ok, type Result } from '../../../shared/domain/types/result.js';

const MAX_CAPTION_LENGTH = 20;

type BoardPhotoError =
  | { type: 'EMPTY_STORAGE_PATH'; message: string }
  | { type: 'CAPTION_TOO_LONG'; message: string };

interface BoardPhotoProps {
  id: string;
  userId: string;
  storagePath: string;
  caption: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateBoardPhotoParams {
  userId: string;
  storagePath: string;
  caption: string;
}

export class BoardPhoto {
  readonly id: string;
  readonly userId: string;
  readonly storagePath: string;
  readonly caption: string;
  readonly createdAt: string;
  readonly updatedAt: string;

  private constructor(props: BoardPhotoProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.storagePath = props.storagePath;
    this.caption = props.caption;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(
    params: CreateBoardPhotoParams,
    generateId: () => string,
  ): Result<BoardPhoto, BoardPhotoError> {
    if (!params.storagePath || params.storagePath.trim().length === 0) {
      return err({ type: 'EMPTY_STORAGE_PATH', message: 'Storage path must not be empty' });
    }
    if (params.caption.length > MAX_CAPTION_LENGTH) {
      return err({
        type: 'CAPTION_TOO_LONG',
        message: `Caption must not exceed ${MAX_CAPTION_LENGTH} characters`,
      });
    }

    const now = new Date().toISOString();
    return ok(
      new BoardPhoto({
        id: generateId(),
        userId: params.userId,
        storagePath: params.storagePath,
        caption: params.caption,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  static fromProps(props: BoardPhotoProps): BoardPhoto {
    return new BoardPhoto(props);
  }

  toProps(): BoardPhotoProps {
    return {
      id: this.id,
      userId: this.userId,
      storagePath: this.storagePath,
      caption: this.caption,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
