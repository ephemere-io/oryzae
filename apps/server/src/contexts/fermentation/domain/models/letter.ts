interface LetterProps {
  id: string;
  fermentationResultId: string;
  bodyText: string;
  /** Jar view position (0-100, percentage of the QuestionCircle). null → fall back. */
  jarX: number | null;
  jarY: number | null;
  createdAt: string;
  updatedAt: string;
}

export class Letter {
  readonly id: string;
  readonly fermentationResultId: string;
  readonly bodyText: string;
  readonly jarX: number | null;
  readonly jarY: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;

  private constructor(props: LetterProps) {
    this.id = props.id;
    this.fermentationResultId = props.fermentationResultId;
    this.bodyText = props.bodyText;
    this.jarX = props.jarX;
    this.jarY = props.jarY;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(fermentationResultId: string, bodyText: string, generateId: () => string): Letter {
    const now = new Date().toISOString();
    return new Letter({
      id: generateId(),
      fermentationResultId,
      bodyText,
      jarX: null,
      jarY: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromProps(props: LetterProps): Letter {
    return new Letter(props);
  }

  withJarPosition(jarX: number, jarY: number): Letter {
    return new Letter({
      ...this.toProps(),
      jarX,
      jarY,
      updatedAt: new Date().toISOString(),
    });
  }

  toProps(): LetterProps {
    return {
      id: this.id,
      fermentationResultId: this.fermentationResultId,
      bodyText: this.bodyText,
      jarX: this.jarX,
      jarY: this.jarY,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
