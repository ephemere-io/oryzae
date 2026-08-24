export interface BoardStorageGateway {
  upload(userId: string, fileName: string, file: ArrayBuffer, contentType: string): Promise<string>;
  /**
   * 画像を表示するための URL を返す。
   *
   * board-photos は非公開バケットなので、公開 URL ではなく有効期限付きの
   * 署名付き URL を発行する（Issue #504）。公開バケットのままだと
   * `/storage/v1/object/public/...` から認証なしで他人の写真が取得できてしまう。
   * 署名の発行自体が非同期なので、この関数も Promise を返す。
   */
  getImageUrl(storagePath: string): Promise<string>;
  delete(storagePath: string): Promise<void>;
}
