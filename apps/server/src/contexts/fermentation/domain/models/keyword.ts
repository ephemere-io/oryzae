interface KeywordProps {
  id: string;
  fermentationResultId: string;
  keyword: string;
  description: string;
  /** Jar view position (0-100, percentage of the QuestionCircle). null → fall back. */
  jarX: number | null;
  jarY: number | null;
  createdAt: string;
  updatedAt: string;
}

export class Keyword {
  readonly id: string;
  readonly fermentationResultId: string;
  readonly keyword: string;
  readonly description: string;
  readonly jarX: number | null;
  readonly jarY: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;

  private constructor(props: KeywordProps) {
    this.id = props.id;
    this.fermentationResultId = props.fermentationResultId;
    this.keyword = props.keyword;
    this.description = props.description;
    this.jarX = props.jarX;
    this.jarY = props.jarY;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(
    fermentationResultId: string,
    keyword: string,
    description: string,
    generateId: () => string,
  ): Keyword {
    const now = new Date().toISOString();
    return new Keyword({
      id: generateId(),
      fermentationResultId,
      keyword,
      description,
      jarX: null,
      jarY: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromProps(props: KeywordProps): Keyword {
    return new Keyword(props);
  }

  withJarPosition(jarX: number, jarY: number): Keyword {
    return new Keyword({
      ...this.toProps(),
      jarX,
      jarY,
      updatedAt: new Date().toISOString(),
    });
  }

  toProps(): KeywordProps {
    return {
      id: this.id,
      fermentationResultId: this.fermentationResultId,
      keyword: this.keyword,
      description: this.description,
      jarX: this.jarX,
      jarY: this.jarY,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
