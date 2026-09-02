import type { SupabaseClient } from '@supabase/supabase-js';
import type { BoardStorageGateway } from '../../domain/gateways/board-storage.gateway.js';

const BUCKET_NAME = 'board-photos';

/**
 * 署名付き URL の有効期限（秒）。
 * board を開いている間は貼り直しが起きない程度に長く、
 * URL が漏れたときの露出は短く抑えたいので 1 時間とする。
 */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * ファイル名を storage のキーに使える形に均す。
 *
 * Supabase Storage のキーは限られた ASCII しか受け付けない。日本語のファイル名を
 * そのまま繋ぐと Invalid key で落ち、ユーザーには「追加できませんでした」としか
 * 見えなかった（画像の中身は関係なく、名前だけで失敗する）。
 *
 * 名前は保存先を分けるためだけのもので、意味は caption が持つ。読める形に近づける
 * 努力はせず、安全な文字に置き換えて長さも切る。
 */
export function toStorageSafeName(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  const rawBase = dot > 0 ? fileName.slice(0, dot) : fileName;
  const rawExt = dot > 0 ? fileName.slice(dot + 1) : '';

  const base = rawBase
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-._]+|[-._]+$/g, '')
    .slice(0, 60);
  const ext = rawExt
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 10);

  // 全部落ちることがある（名前が日本語だけの場合）。その時は固定名で置く。
  const safeBase = base || 'photo';
  return ext ? `${safeBase}.${ext}` : safeBase;
}

export class SupabaseBoardStorageGateway implements BoardStorageGateway {
  constructor(private supabase: SupabaseClient) {}

  async upload(
    userId: string,
    fileName: string,
    file: ArrayBuffer,
    contentType: string,
  ): Promise<string> {
    const storagePath = `${userId}/${Date.now()}-${toStorageSafeName(fileName)}`;
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
