export interface BoardStorageGateway {
  upload(userId: string, fileName: string, file: ArrayBuffer, contentType: string): Promise<string>;
  getPublicUrl(storagePath: string): string;
  delete(storagePath: string): Promise<void>;
}
