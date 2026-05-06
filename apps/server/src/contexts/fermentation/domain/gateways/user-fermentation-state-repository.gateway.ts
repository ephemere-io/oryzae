import type { UserFermentationState } from '../models/user-fermentation-state.js';

export interface UserFermentationStateRepositoryGateway {
  findByUserId(userId: string): Promise<UserFermentationState | null>;
  upsert(state: UserFermentationState): Promise<void>;
}
