import { err, ok, type Result } from '../../../shared/domain/types/result.js';

const VALID_CARD_TYPES = ['entry', 'snippet'] as const;
const VALID_VIEW_TYPES = ['daily', 'weekly'] as const;
const MIN_SIZE = 120;

type CardType = (typeof VALID_CARD_TYPES)[number];
type ViewType = (typeof VALID_VIEW_TYPES)[number];

function isCardType(value: string): value is CardType {
  return value === 'entry' || value === 'snippet';
}

function isViewType(value: string): value is ViewType {
  return value === 'daily' || value === 'weekly';
}

type BoardCardError =
  | { type: 'INVALID_CARD_TYPE'; message: string }
  | { type: 'INVALID_VIEW_TYPE'; message: string }
  | { type: 'INVALID_DIMENSIONS'; message: string }
  | { type: 'MISSING_REF_ID'; message: string };

interface BoardCardProps {
  id: string;
  userId: string;
  cardType: CardType;
  refId: string;
  dateKey: string;
  viewType: ViewType;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  zIndex: number;
  createdAt: string;
  updatedAt: string;
}

interface CreateBoardCardParams {
  userId: string;
  cardType: string;
  refId: string;
  dateKey: string;
  viewType: string;
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
  readonly dateKey: string;
  readonly viewType: ViewType;
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly width: number;
  readonly height: number;
  readonly zIndex: number;
  readonly createdAt: string;
  readonly updatedAt: string;

  private constructor(props: BoardCardProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.cardType = props.cardType;
    this.refId = props.refId;
    this.dateKey = props.dateKey;
    this.viewType = props.viewType;
    this.x = props.x;
    this.y = props.y;
    this.rotation = props.rotation;
    this.width = props.width;
    this.height = props.height;
    this.zIndex = props.zIndex;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(
    params: CreateBoardCardParams,
    generateId: () => string,
  ): Result<BoardCard, BoardCardError> {
    const { cardType, viewType } = params;
    if (!isCardType(cardType)) {
      return err({
        type: 'INVALID_CARD_TYPE',
        message: `Card type must be one of: ${VALID_CARD_TYPES.join(', ')}`,
      });
    }
    if (!isViewType(viewType)) {
      return err({
        type: 'INVALID_VIEW_TYPE',
        message: `View type must be one of: ${VALID_VIEW_TYPES.join(', ')}`,
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
        dateKey: params.dateKey,
        viewType,
        x: params.x,
        y: params.y,
        rotation: params.rotation,
        width: params.width,
        height: params.height,
        zIndex: params.zIndex,
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
      dateKey: this.dateKey,
      viewType: this.viewType,
      x: this.x,
      y: this.y,
      rotation: this.rotation,
      width: this.width,
      height: this.height,
      zIndex: this.zIndex,
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
