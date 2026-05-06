import type { FermentationLanguage } from '../services/fermentation-eligibility.service.js';

interface FermentationOutput {
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

interface LlmUsage {
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
    // 出力言語 (issue #279)。M-GTA 分析の system prompt と output schema description を切り替える。
    // 解決失敗時は呼び出し側で 'ja' に倒すこと (#268 の方針を踏襲)。
    language: FermentationLanguage;
  }): Promise<LlmAnalysisResult>;
}
