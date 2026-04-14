import type { FermentationRepositoryGateway } from '../../domain/gateways/fermentation-repository.gateway.js';
import type { LlmAnalysisGateway } from '../../domain/gateways/llm-analysis.gateway.js';
import { AnalysisWorksheet } from '../../domain/models/analysis-worksheet.js';
import { ExtractedSnippet } from '../../domain/models/extracted-snippet.js';
import { FermentationResult } from '../../domain/models/fermentation-result.js';
import { Keyword } from '../../domain/models/keyword.js';
import { Letter } from '../../domain/models/letter.js';
import { LlmAnalysisError } from '../errors/fermentation.errors.js';

export class RunFermentationUsecase {
  constructor(
    private fermentationRepo: FermentationRepositoryGateway,
    private llmGateway: LlmAnalysisGateway,
    private generateId: () => string,
  ) {}

  async execute(params: {
    userId: string;
    questionId: string;
    questionText: string;
    entryId: string;
    entryContent: string;
  }): Promise<{ id: string }> {
    const today = new Date().toISOString().slice(0, 10);
    const targetPeriod = today;

    // 1. Create pending result
    const createResult = FermentationResult.create(
      {
        userId: params.userId,
        questionId: params.questionId,
        entryId: params.entryId,
        targetPeriod,
      },
      this.generateId,
    );
    if (!createResult.success) {
      throw new LlmAnalysisError(createResult.error.message);
    }
    const fermentationResult = createResult.value;
    await this.fermentationRepo.save(fermentationResult);

    // 2. Update to processing
    const processingResult = fermentationResult.withStatus('processing');
    if (processingResult.success) {
      await this.fermentationRepo.update(processingResult.value);
    }

    try {
      // 3. Run LLM analysis
      const { output, generationId } = await this.llmGateway.analyze({
        question: params.questionText,
        entryContent: params.entryContent,
        targetPeriod,
        userId: params.userId,
      });

      // 3.5. Track generation ID for cost tracking
      let currentResult = fermentationResult;
      if (generationId) {
        currentResult = fermentationResult.withGenerationId(generationId);
        await this.fermentationRepo.update(currentResult);
      }

      // 4. Save all results
      const worksheet = AnalysisWorksheet.create(
        fermentationResult.id,
        output.worksheetMarkdown,
        output.resultDiagramMarkdown,
        this.generateId,
      );
      await this.fermentationRepo.saveWorksheet(worksheet);

      const snippets = output.snippets.map((s) => {
        const result = ExtractedSnippet.create(
          {
            fermentationResultId: fermentationResult.id,
            snippetType: s.type as 'new_perspective' | 'deepen' | 'core',
            originalText: s.text,
            sourceDate: s.sourceDate,
            selectionReason: s.reason,
          },
          this.generateId,
        );
        if (!result.success) throw new LlmAnalysisError(result.error.message);
        return result.value;
      });
      await this.fermentationRepo.saveSnippets(snippets);

      const letter = Letter.create(fermentationResult.id, output.letterBody, this.generateId);
      await this.fermentationRepo.saveLetter(letter);

      const keywords = output.keywords.map((k) =>
        Keyword.create(fermentationResult.id, k.keyword, k.description, this.generateId),
      );
      await this.fermentationRepo.saveKeywords(keywords);

      // 5. Mark completed
      const completedResult = currentResult.withStatus('completed');
      if (completedResult.success) {
        await this.fermentationRepo.update(completedResult.value);
      }

      return { id: currentResult.id };
    } catch (error) {
      // Mark failed with error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const withError = fermentationResult.withErrorMessage(errorMessage);
      const failedResult = withError.withStatus('failed');
      if (failedResult.success) {
        await this.fermentationRepo.update(failedResult.value);
      }
      if (error instanceof LlmAnalysisError) throw error;
      throw new LlmAnalysisError(errorMessage);
    }
  }
}
