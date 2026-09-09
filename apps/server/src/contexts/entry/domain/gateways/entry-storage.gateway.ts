/**
 * エントリに添える写真の保管先。実装は infrastructure/storage（Supabase Storage）。
 *
 * バケットは private なので公開 URL は存在しない。表示用の URL は都度署名して発行する
 * （#504 と同じ判断。詳細は 00023_create_entry_photos.sql）。
 */
export interface EntryStorageGateway {
  upload(userId: string, fileName: string, file: ArrayBuffer, contentType: string): Promise<string>;
  getSignedUrl(storagePath: string): Promise<string>;
  /** 一覧・詳細でまとめて署名する用。失敗したパスは Map から落ちる。 */
  getSignedUrls(storagePaths: string[]): Promise<Map<string, string>>;
  delete(storagePath: string): Promise<void>;
}
