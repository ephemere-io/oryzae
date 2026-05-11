import type { UserProfileRepositoryGateway } from '../../domain/gateways/user-profile-repository.gateway.js';
import {
  computeSignupAvailability,
  type SignupAvailability,
} from '../../domain/policies/signup-capacity.policy.js';

/**
 * 現在のサインアップ枠の空き状況を返す。
 *
 * `profiles` テーブルの行数 (= 完了済み登録ユーザー数) と
 * 設定上限値から `SignupAvailability` を算出する。
 */
export class GetSignupAvailabilityUsecase {
  constructor(
    private readonly profileRepo: UserProfileRepositoryGateway,
    private readonly limit: number,
  ) {}

  async execute(): Promise<SignupAvailability> {
    const used = await this.profileRepo.count();
    return computeSignupAvailability(used, this.limit);
  }
}
