import type { SupabaseClient } from '@supabase/supabase-js';
import type { BoardStorageGateway } from '../../domain/gateways/board-storage.gateway.js';

const BUCKET_NAME = 'board-photos';

export class SupabaseBoardStorageGateway implements BoardStorageGateway {
  constructor(private supabase: SupabaseClient) {}

  async upload(
    userId: string,
    fileName: string,
    file: ArrayBuffer,
    contentType: string,
  ): Promise<string> {
    const storagePath = `${userId}/${Date.now()}-${fileName}`;
    const { error } = await this.supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, file, { contentType, upsert: false });

    if (error) throw error;
    return storagePath;
  }

  getPublicUrl(storagePath: string): string {
    const { data } = this.supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
    return data.publicUrl;
  }

  async delete(storagePath: string): Promise<void> {
    const { error } = await this.supabase.storage.from(BUCKET_NAME).remove([storagePath]);
    if (error) throw error;
  }
}
