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

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LlmAnalysisResult {
  output: FermentationOutput;
  usage: LlmUsage;
  generationId: string | undefined;
}

export interface LlmAnalysisGateway {
  analyze(params: {
    question: string;
    entryContent: string;
    targetPeriod: string;
    userId: string;
  }): Promise<LlmAnalysisResult>;
}
