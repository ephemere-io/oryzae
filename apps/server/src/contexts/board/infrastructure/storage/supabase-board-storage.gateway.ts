import type { SupabaseClient } from '@supabase/supabase-js';
import type { BoardStorageGateway } from '../../domain/gateways/board-storage.gateway.js';

const BUCKET_NAME = 'board-photos';

// 署名付き URL の有効期限（秒）。ボードを開いた直後に画像を描画するための時間があれば足り、
// 長くするほど「URL が流出したときに他人が見られる時間」が伸びる。
// 期限切れ後はボードを再読み込みすれば新しい URL が発行される。
const SIGNED_URL_TTL_SECONDS = 60 * 60;

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

  async getImageUrl(storagePath: string): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

    if (error || !data) {
      // storagePath はユーザーの写真の保管場所であり、それ自体は日記本文ではないが、
      // 誰が何を持っているかの手掛かりになるためメッセージには含めない。
      throw error ?? new Error('Failed to create signed URL for board photo');
    }
    return data.signedUrl;
  }

  async delete(storagePath: string): Promise<void> {
    const { error } = await this.supabase.storage.from(BUCKET_NAME).remove([storagePath]);
    if (error) throw error;
  }
}
