import type { UserProfileRepositoryGateway } from '../../domain/gateways/user-profile-repository.gateway.js';
import type { UserProfileProps } from '../../domain/models/user-profile.js';
import { UserProfileNotFoundError } from '../errors/user.errors.js';

export class CompleteOnboardingUsecase {
  constructor(private profileRepo: UserProfileRepositoryGateway) {}

  async execute(userId: string): Promise<UserProfileProps> {
    const profile = await this.profileRepo.findById(userId);
    if (!profile) throw new UserProfileNotFoundError(userId);

    const completed = profile.withOnboardingCompleted();
    if (completed !== profile) {
      await this.profileRepo.save(completed);
    }

    return completed.toProps();
  }
}
