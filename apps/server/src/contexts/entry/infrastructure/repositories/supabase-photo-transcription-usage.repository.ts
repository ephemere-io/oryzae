import type { SupabaseClient } from '@supabase/supabase-js';
import type { PhotoTranscriptionUsageRepositoryGateway } from '../../domain/gateways/photo-transcription-usage-repository.gateway.js';
import type { PhotoTranscriptionUsage } from '../../domain/models/photo-transcription-usage.js';

export class SupabasePhotoTranscriptionUsageRepository
  implements PhotoTranscriptionUsageRepositoryGateway
{
  constructor(private supabase: SupabaseClient) {}

  async save(usage: PhotoTranscriptionUsage): Promise<void> {
    const props = usage.toProps();
    const { error } = await this.supabase.from('photo_transcription_usages').insert({
      id: props.id,
      user_id: props.userId,
      model: props.model,
      input_tokens: props.inputTokens,
      output_tokens: props.outputTokens,
      char_count: props.charCount,
      created_at: props.createdAt,
    });

    if (error) throw error;
  }
}
