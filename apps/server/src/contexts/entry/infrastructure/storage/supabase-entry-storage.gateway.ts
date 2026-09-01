import type { SupabaseClient } from '@supabase/supabase-js';
import { toSafeStorageFileName } from '../../../shared/infrastructure/storage-object-name.js';
import type { EntryStorageGateway } from '../../domain/gateways/entry-storage.gateway.js';

const BUCKET_NAME = 'entry-photos';

/**
 * 署名付き URL の有効期限（秒）。board と揃えて 1 時間。
 * エントリを開いている間に切れない程度に長く、URL が漏れたときの露出は短く抑える。
 */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export class SupabaseEntryStorageGateway implements EntryStorageGateway {
  constructor(private supabase: SupabaseClient) {}

  async upload(
    userId: string,
    fileName: string,
    file: ArrayBuffer,
    contentType: string,
  ): Promise<string> {
    // 先頭セグメントを userId にすることで Storage の RLS（00023）が効く。
    // ファイル名はそのまま使えない。日本語名は Storage が 400 InvalidKey で弾く。
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
    if (!data?.signedUrl) throw new Error(`Failed to sign entry photo: ${storagePath}`);
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
