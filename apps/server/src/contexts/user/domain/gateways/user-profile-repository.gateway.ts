import type { UserProfile } from '../models/user-profile.js';

export interface UserProfileRepositoryGateway {
  findById(id: string): Promise<UserProfile | null>;
  save(profile: UserProfile): Promise<void>;
}
