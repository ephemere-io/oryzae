/** エントリに添える写真の保管先。実装は infrastructure/storage（Supabase Storage）。 */
export interface EntryStorageGateway {
  upload(userId: string, fileName: string, file: ArrayBuffer, contentType: string): Promise<string>;
  getPublicUrl(storagePath: string): string;
  delete(storagePath: string): Promise<void>;
}
