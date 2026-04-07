export interface FermentationOutput {
  worksheetMarkdown: string;
  resultDiagramMarkdown: string;
  snippets: {
    type: 'new_perspective' | 'deepen' | 'core';
    text: string;
    sourceDate: string;
    reason: string;
  }[];
  letterBody: string;
  keywords: { keyword: string; description: string }[];
}

export interface LlmAnalysisGateway {
  analyze(params: {
    question: string;
    entryContent: string;
    targetPeriod: string;
  }): Promise<FermentationOutput>;
}
