import type { UserProfile } from '../models/user-profile.js';

export interface UserProfileRepositoryGateway {
  findById(id: string): Promise<UserProfile | null>;
  save(profile: UserProfile): Promise<void>;
  /** profiles テーブルの行数（Research Preview の登録枠管理に使用） */
  count(): Promise<number>;
}
