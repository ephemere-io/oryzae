import type { SupabaseClient } from '@supabase/supabase-js';
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
    // @type-assertion-allowed: Supabase row data is untyped Record<string, unknown>
    return UserProfile.fromProps({
      id: row.id as string,
      nickname: row.nickname as string,
      avatarUrl: (row.avatar_url as string | null) ?? null,
      onboardingCompleted: row.onboarding_completed as boolean,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    });
  }
}
