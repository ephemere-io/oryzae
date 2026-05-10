import type { JarPositionUpdate as FermJarPositionUpdate } from '../../../fermentation/domain/gateways/fermentation-repository.gateway.js';
import type {
  JarPositionUpdate as QuestionJarPositionUpdate,
  QuestionRepositoryGateway,
} from '../../../question/domain/gateways/question-repository.gateway.js';
import type { FermentationRepositoryGateway } from '../../domain/gateways/fermentation-repository.gateway.js';

interface SaveJarLayoutInput {
  questions: QuestionJarPositionUpdate[];
  keywords: FermJarPositionUpdate[];
  snippets: FermJarPositionUpdate[];
  letters: FermJarPositionUpdate[];
}

/**
 * Persist Jar view drag-and-drop positions across questions, keywords, snippets, and letters.
 * The four repo updates run in parallel; cross-user writes are blocked by Supabase RLS.
 */
export class SaveJarLayoutUsecase {
  constructor(
    private questionRepo: QuestionRepositoryGateway,
    private fermentationRepo: FermentationRepositoryGateway,
  ) {}

  async execute(input: SaveJarLayoutInput): Promise<void> {
    await Promise.all([
      this.questionRepo.updateJarPositions(input.questions),
      this.fermentationRepo.updateKeywordJarPositions(input.keywords),
      this.fermentationRepo.updateSnippetJarPositions(input.snippets),
      this.fermentationRepo.updateLetterJarPositions(input.letters),
    ]);
  }
}
