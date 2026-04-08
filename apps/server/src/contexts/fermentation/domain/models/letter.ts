interface LetterProps {
  id: string;
  fermentationResultId: string;
  bodyText: string;
}

export class Letter {
  readonly id: string;
  readonly fermentationResultId: string;
  readonly bodyText: string;

  private constructor(props: LetterProps) {
    this.id = props.id;
    this.fermentationResultId = props.fermentationResultId;
    this.bodyText = props.bodyText;
  }

  static create(fermentationResultId: string, bodyText: string, generateId: () => string): Letter {
    return new Letter({ id: generateId(), fermentationResultId, bodyText });
  }

  static fromProps(props: LetterProps): Letter {
    return new Letter(props);
  }

  toProps(): LetterProps {
    return {
      id: this.id,
      fermentationResultId: this.fermentationResultId,
      bodyText: this.bodyText,
    };
  }
}
