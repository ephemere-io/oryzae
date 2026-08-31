export interface BoardStorageGateway {
  upload(userId: string, fileName: string, file: ArrayBuffer, contentType: string): Promise<string>;
  /** 非公開バケットのオブジェクトを一定時間だけ読める署名付き URL を返す。 */
  getSignedUrl(storagePath: string): Promise<string>;
  /** 複数パスをまとめて署名する。戻り値は storagePath -> 署名付き URL。 */
  getSignedUrls(storagePaths: string[]): Promise<Map<string, string>>;
  delete(storagePath: string): Promise<void>;
}
