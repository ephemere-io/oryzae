interface AnalysisWorksheetProps {
  id: string;
  fermentationResultId: string;
  worksheetMarkdown: string;
  resultDiagramMarkdown: string;
  createdAt: string;
  updatedAt: string;
}

export class AnalysisWorksheet {
  readonly id: string;
  readonly fermentationResultId: string;
  readonly worksheetMarkdown: string;
  readonly resultDiagramMarkdown: string;
  readonly createdAt: string;
  readonly updatedAt: string;

  private constructor(props: AnalysisWorksheetProps) {
    this.id = props.id;
    this.fermentationResultId = props.fermentationResultId;
    this.worksheetMarkdown = props.worksheetMarkdown;
    this.resultDiagramMarkdown = props.resultDiagramMarkdown;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(
    fermentationResultId: string,
    worksheetMarkdown: string,
    resultDiagramMarkdown: string,
    generateId: () => string,
  ): AnalysisWorksheet {
    return new AnalysisWorksheet({
      id: generateId(),
      fermentationResultId,
      worksheetMarkdown,
      resultDiagramMarkdown,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  static fromProps(props: AnalysisWorksheetProps): AnalysisWorksheet {
    return new AnalysisWorksheet(props);
  }

  toProps(): AnalysisWorksheetProps {
    return {
      id: this.id,
      fermentationResultId: this.fermentationResultId,
      worksheetMarkdown: this.worksheetMarkdown,
      resultDiagramMarkdown: this.resultDiagramMarkdown,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
