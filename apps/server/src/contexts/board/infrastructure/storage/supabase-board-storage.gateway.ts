import type { SupabaseClient } from '@supabase/supabase-js';
import { toSafeStorageFileName } from '../../../shared/infrastructure/storage-object-name.js';
import type { BoardStorageGateway } from '../../domain/gateways/board-storage.gateway.js';

const BUCKET_NAME = 'board-photos';

/**
 * 署名付き URL の有効期限（秒）。
 * board を開いている間は貼り直しが起きない程度に長く、
 * URL が漏れたときの露出は短く抑えたいので 1 時間とする。
 */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export class SupabaseBoardStorageGateway implements BoardStorageGateway {
  constructor(private supabase: SupabaseClient) {}

  async upload(
    userId: string,
    fileName: string,
    file: ArrayBuffer,
    contentType: string,
  ): Promise<string> {
    const storagePath = `${userId}/${Date.now()}-${toSafeStorageFileName(fileName)}`;
    const { error } = await this.supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, file, { contentType, upsert: false });

    if (error) throw error;
    return storagePath;
  }

  async getSignedUrl(storagePath: string): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

    if (error) throw error;
    if (!data?.signedUrl) throw new Error(`Failed to sign board photo: ${storagePath}`);
    return data.signedUrl;
  }

  async getSignedUrls(storagePaths: string[]): Promise<Map<string, string>> {
    const urls = new Map<string, string>();
    if (storagePaths.length === 0) return urls;

    const { data, error } = await this.supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrls(storagePaths, SIGNED_URL_TTL_SECONDS);

    if (error) throw error;
    for (const item of data ?? []) {
      // 個別に失敗したパスは path/signedUrl が欠ける。その写真だけ落とす。
      if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
    }
    return urls;
  }

  async delete(storagePath: string): Promise<void> {
    const { error } = await this.supabase.storage.from(BUCKET_NAME).remove([storagePath]);
    if (error) throw error;
  }
}
