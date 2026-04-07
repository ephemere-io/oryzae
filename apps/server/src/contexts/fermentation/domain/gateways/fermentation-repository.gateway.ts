import type { AnalysisWorksheet } from '../models/analysis-worksheet.js';
import type { ExtractedSnippet } from '../models/extracted-snippet.js';
import type { FermentationResult } from '../models/fermentation-result.js';
import type { Keyword } from '../models/keyword.js';
import type { Letter } from '../models/letter.js';

export interface FermentationResultWithDetails {
  result: FermentationResult;
  worksheet: AnalysisWorksheet | null;
  snippets: ExtractedSnippet[];
  letter: Letter | null;
  keywords: Keyword[];
}

export interface FermentationRepositoryGateway {
  save(result: FermentationResult): Promise<void>;
  update(result: FermentationResult): Promise<void>;
  findById(id: string): Promise<FermentationResult | null>;
  findByIdWithDetails(id: string): Promise<FermentationResultWithDetails | null>;
  listByQuestionId(questionId: string): Promise<FermentationResult[]>;

  saveWorksheet(worksheet: AnalysisWorksheet): Promise<void>;
  saveSnippets(snippets: ExtractedSnippet[]): Promise<void>;
  saveLetter(letter: Letter): Promise<void>;
  saveKeywords(keywords: Keyword[]): Promise<void>;
}
