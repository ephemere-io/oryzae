import type { SupabaseClient } from '@supabase/supabase-js';
import { readBoolean, readString, readStringOrNull } from '../../../shared/infrastructure/row.js';
import type { UserProfileRepositoryGateway } from '../../domain/gateways/user-profile-repository.gateway.js';
import { UserProfile } from '../../domain/models/user-profile.js';

export class SupabaseUserProfileRepository implements UserProfileRepositoryGateway {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string): Promise<UserProfile | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('id, nickname, avatar_url, onboarding_completed, created_at, updated_at')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.toDomain(data);
  }

  async save(profile: UserProfile): Promise<void> {
    const props = profile.toProps();
    const { error } = await this.supabase
      .from('profiles')
      .update({
        nickname: props.nickname,
        avatar_url: props.avatarUrl,
        onboarding_completed: props.onboardingCompleted,
        updated_at: props.updatedAt,
      })
      .eq('id', props.id);
    if (error) throw error;
  }

  async count(): Promise<number> {
    const { count, error } = await this.supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });
    if (error) throw error;
    return count ?? 0;
  }

  private toDomain(row: Record<string, unknown>): UserProfile {
    return UserProfile.fromProps({
      id: readString(row, 'id'),
      nickname: readString(row, 'nickname'),
      avatarUrl: readStringOrNull(row, 'avatar_url'),
      onboardingCompleted: readBoolean(row, 'onboarding_completed'),
      createdAt: readString(row, 'created_at'),
      updatedAt: readString(row, 'updated_at'),
    });
  }
}
