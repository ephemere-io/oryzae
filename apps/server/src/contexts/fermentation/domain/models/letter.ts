interface LetterProps {
  id: string;
  fermentationResultId: string;
  bodyText: string;
  createdAt: string;
  updatedAt: string;
}

export class Letter {
  readonly id: string;
  readonly fermentationResultId: string;
  readonly bodyText: string;
  readonly createdAt: string;
  readonly updatedAt: string;

  private constructor(props: LetterProps) {
    this.id = props.id;
    this.fermentationResultId = props.fermentationResultId;
    this.bodyText = props.bodyText;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(fermentationResultId: string, bodyText: string, generateId: () => string): Letter {
    const now = new Date().toISOString();
    return new Letter({
      id: generateId(),
      fermentationResultId,
      bodyText,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromProps(props: LetterProps): Letter {
    return new Letter(props);
  }

  toProps(): LetterProps {
    return {
      id: this.id,
      fermentationResultId: this.fermentationResultId,
      bodyText: this.bodyText,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
