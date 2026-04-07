import type { FermentationRepositoryGateway } from '../../domain/gateways/fermentation-repository.gateway.js';
import type { FermentationResultProps } from '../../domain/models/fermentation-result.js';

export class ListFermentationResultsUsecase {
  constructor(private fermentationRepo: FermentationRepositoryGateway) {}

  async execute(questionId: string): Promise<FermentationResultProps[]> {
    const results = await this.fermentationRepo.listByQuestionId(questionId);
    return results.map((r) => r.toProps());
  }
}
