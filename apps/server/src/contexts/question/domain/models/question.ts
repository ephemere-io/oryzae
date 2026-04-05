export interface QuestionProps {
  id: string;
  userId: string;
  isArchived: boolean;
  isValidatedByUser: boolean;
  isProposedByOryzae: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CreateQuestionParams {
  userId: string;
  isProposedByOryzae: boolean;
}

export class Question {
  readonly id: string;
  readonly userId: string;
  readonly isArchived: boolean;
  readonly isValidatedByUser: boolean;
  readonly isProposedByOryzae: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;

  private constructor(props: QuestionProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.isArchived = props.isArchived;
    this.isValidatedByUser = props.isValidatedByUser;
    this.isProposedByOryzae = props.isProposedByOryzae;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(params: CreateQuestionParams, generateId: () => string): Question {
    const now = new Date().toISOString();
    return new Question({
      id: generateId(),
      userId: params.userId,
      isArchived: false,
      isValidatedByUser: !params.isProposedByOryzae,
      isProposedByOryzae: params.isProposedByOryzae,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromProps(props: QuestionProps): Question {
    return new Question(props);
  }

  get isActive(): boolean {
    return !this.isArchived && this.isValidatedByUser;
  }

  withArchived(): Question {
    return new Question({
      ...this.toProps(),
      isArchived: true,
      updatedAt: new Date().toISOString(),
    });
  }

  withUnarchived(): Question {
    return new Question({
      ...this.toProps(),
      isArchived: false,
      updatedAt: new Date().toISOString(),
    });
  }

  withValidated(): Question {
    return new Question({
      ...this.toProps(),
      isValidatedByUser: true,
      updatedAt: new Date().toISOString(),
    });
  }

  toProps(): QuestionProps {
    return {
      id: this.id,
      userId: this.userId,
      isArchived: this.isArchived,
      isValidatedByUser: this.isValidatedByUser,
      isProposedByOryzae: this.isProposedByOryzae,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
