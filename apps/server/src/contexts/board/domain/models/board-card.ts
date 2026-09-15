import { err, ok, type Result } from '../../../shared/domain/types/result.js';

const VALID_CARD_TYPES = ['entry', 'snippet', 'photo'] as const;
const MIN_SIZE = 120;

type CardType = (typeof VALID_CARD_TYPES)[number];

function isCardType(value: string): value is CardType {
  return value === 'entry' || value === 'snippet' || value === 'photo';
}

type BoardCardError =
  | { type: 'INVALID_CARD_TYPE'; message: string }
  | { type: 'INVALID_DIMENSIONS'; message: string }
  | { type: 'MISSING_REF_ID'; message: string };

/**
 * ボードに貼った 1 枚（付箋・写真の置き場所）。
 *
 * ボードは 1 人に 1 枚のコルクボードで、日付や表示単位（日次/週次）ごとの盤面は持たない。
 * 同じ付箋・写真は 1 枚だけ貼られる（DB の一意制約 `(user_id, ref_id)`）。
 */
interface BoardCardProps {
  id: string;
  userId: string;
  cardType: CardType;
  refId: string;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  zIndex: number;
  /** 利用者が自分で位置を決めたか。false なら作成日時順に自動整列してよい。 */
  userPositioned: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CreateBoardCardParams {
  userId: string;
  cardType: string;
  refId: string;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  zIndex: number;
}

export class BoardCard {
  readonly id: string;
  readonly userId: string;
  readonly cardType: CardType;
  readonly refId: string;
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly width: number;
  readonly height: number;
  readonly zIndex: number;
  readonly userPositioned: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;

  private constructor(props: BoardCardProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.cardType = props.cardType;
    this.refId = props.refId;
    this.x = props.x;
    this.y = props.y;
    this.rotation = props.rotation;
    this.width = props.width;
    this.height = props.height;
    this.zIndex = props.zIndex;
    this.userPositioned = props.userPositioned;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(
    params: CreateBoardCardParams,
    generateId: () => string,
  ): Result<BoardCard, BoardCardError> {
    const { cardType } = params;
    if (!isCardType(cardType)) {
      return err({
        type: 'INVALID_CARD_TYPE',
        message: `Card type must be one of: ${VALID_CARD_TYPES.join(', ')}`,
      });
    }
    if (!params.refId || params.refId.trim().length === 0) {
      return err({ type: 'MISSING_REF_ID', message: 'refId must not be empty' });
    }
    const dimError = BoardCard.validateDimensions(params.width, params.height);
    if (dimError) return err(dimError);

    const now = new Date().toISOString();
    return ok(
      new BoardCard({
        id: generateId(),
        userId: params.userId,
        cardType,
        refId: params.refId,
        x: params.x,
        y: params.y,
        rotation: params.rotation,
        width: params.width,
        height: params.height,
        zIndex: params.zIndex,
        // 生成時は自動配置。利用者が動かした時点で true になる。
        userPositioned: false,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  static fromProps(props: BoardCardProps): BoardCard {
    return new BoardCard(props);
  }

  withPosition(x: number, y: number, rotation: number): BoardCard {
    return new BoardCard({
      ...this.toProps(),
      x,
      y,
      rotation,
      updatedAt: new Date().toISOString(),
    });
  }

  withDimensions(width: number, height: number): Result<BoardCard, BoardCardError> {
    const dimError = BoardCard.validateDimensions(width, height);
    if (dimError) return err(dimError);

    return ok(
      new BoardCard({
        ...this.toProps(),
        width,
        height,
        updatedAt: new Date().toISOString(),
      }),
    );
  }

  withZIndex(zIndex: number): BoardCard {
    return new BoardCard({
      ...this.toProps(),
      zIndex,
      updatedAt: new Date().toISOString(),
    });
  }

  toProps(): BoardCardProps {
    return {
      id: this.id,
      userId: this.userId,
      cardType: this.cardType,
      refId: this.refId,
      x: this.x,
      y: this.y,
      rotation: this.rotation,
      width: this.width,
      height: this.height,
      zIndex: this.zIndex,
      userPositioned: this.userPositioned,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  private static validateDimensions(width: number, height: number): BoardCardError | null {
    if (width < MIN_SIZE || height < MIN_SIZE) {
      return {
        type: 'INVALID_DIMENSIONS',
        message: `Width and height must be at least ${MIN_SIZE}px`,
      };
    }
    return null;
  }
}
