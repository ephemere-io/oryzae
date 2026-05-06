import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserFermentationStateRepositoryGateway } from '../../domain/gateways/user-fermentation-state-repository.gateway.js';
import { UserFermentationState } from '../../domain/models/user-fermentation-state.js';

export class SupabaseUserFermentationStateRepository
  implements UserFermentationStateRepositoryGateway
{
  constructor(private supabase: SupabaseClient) {}

  async findByUserId(userId: string): Promise<UserFermentationState | null> {
    const { data, error } = await this.supabase
      .from('user_fermentation_state')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(`Failed to fetch user fermentation state: ${error.message}`);
    if (!data) return null;
    // numeric(3,2) は postgrest 経由だと文字列になる場合があるため Number で正規化する。
    return UserFermentationState.fromProps({
      userId: data.user_id,
      lastRunAt: data.last_run_at ?? null,
      nextEligibleAt: data.next_eligible_at ?? null,
      nextRandomHours: data.next_random_hours == null ? null : Number(data.next_random_hours),
      charsSinceLast: Number(data.chars_since_last ?? 0),
      readinessScore: Number(data.readiness_score ?? 0),
      updatedAt: data.updated_at,
    });
  }

  async upsert(state: UserFermentationState): Promise<void> {
    const props = state.toProps();
    const { error } = await this.supabase.from('user_fermentation_state').upsert(
      {
        user_id: props.userId,
        last_run_at: props.lastRunAt,
        next_eligible_at: props.nextEligibleAt,
        next_random_hours: props.nextRandomHours,
        chars_since_last: props.charsSinceLast,
        readiness_score: props.readinessScore,
        updated_at: props.updatedAt,
      },
      { onConflict: 'user_id' },
    );
    if (error) throw new Error(`Failed to upsert user fermentation state: ${error.message}`);
  }
}
