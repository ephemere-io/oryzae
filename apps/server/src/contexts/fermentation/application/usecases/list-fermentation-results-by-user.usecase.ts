import type { FermentationRepositoryGateway } from '../../domain/gateways/fermentation-repository.gateway.js';
import type { FermentationResultProps } from '../../domain/models/fermentation-result.js';

/**
 * issue #363 perf: ユーザーの全発酵結果を1回で返す。瓶の未読バッジ・受信箱の N+1
 * （/questions → 問いごとに /fermentations）を解消するためのバルク取得 usecase。
 */
export class ListFermentationResultsByUserUsecase {
  constructor(private fermentationRepo: FermentationRepositoryGateway) {}

  async execute(userId: string): Promise<FermentationResultProps[]> {
    const results = await this.fermentationRepo.listByUserId(userId);
    return results.map((r) => r.toProps());
  }
}
