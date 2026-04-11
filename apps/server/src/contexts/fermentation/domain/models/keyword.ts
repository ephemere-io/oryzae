interface KeywordProps {
  id: string;
  fermentationResultId: string;
  keyword: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export class Keyword {
  readonly id: string;
  readonly fermentationResultId: string;
  readonly keyword: string;
  readonly description: string;
  readonly createdAt: string;
  readonly updatedAt: string;

  private constructor(props: KeywordProps) {
    this.id = props.id;
    this.fermentationResultId = props.fermentationResultId;
    this.keyword = props.keyword;
    this.description = props.description;
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
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromProps(props: KeywordProps): Keyword {
    return new Keyword(props);
  }

  toProps(): KeywordProps {
    return {
      id: this.id,
      fermentationResultId: this.fermentationResultId,
      keyword: this.keyword,
      description: this.description,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
