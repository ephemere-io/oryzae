export interface KeywordProps {
  id: string;
  fermentationResultId: string;
  keyword: string;
  description: string;
}

export class Keyword {
  readonly id: string;
  readonly fermentationResultId: string;
  readonly keyword: string;
  readonly description: string;

  private constructor(props: KeywordProps) {
    this.id = props.id;
    this.fermentationResultId = props.fermentationResultId;
    this.keyword = props.keyword;
    this.description = props.description;
  }

  static create(
    fermentationResultId: string,
    keyword: string,
    description: string,
    generateId: () => string,
  ): Keyword {
    return new Keyword({ id: generateId(), fermentationResultId, keyword, description });
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
    };
  }
}
