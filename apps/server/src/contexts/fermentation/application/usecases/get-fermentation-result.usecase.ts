import type {
  FermentationRepositoryGateway,
  FermentationResultWithDetails,
} from '../../domain/gateways/fermentation-repository.gateway.js';
import { FermentationNotFoundError } from '../errors/fermentation.errors.js';

export class GetFermentationResultUsecase {
  constructor(private fermentationRepo: FermentationRepositoryGateway) {}

  async execute(id: string): Promise<FermentationResultWithDetails> {
    const result = await this.fermentationRepo.findByIdWithDetails(id);
    if (!result) throw new FermentationNotFoundError(id);
    return result;
  }
}
