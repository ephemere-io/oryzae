import type { EntryStorageGateway } from '../../domain/gateways/entry-storage.gateway.js';

interface UploadEntryPhotoInput {
  file: ArrayBuffer;
  fileName: string;
  contentType: string;
}

interface UploadEntryPhotoResponse {
  storagePath: string;
  url: string;
}

/**
 * エントリに添える写真を Storage に保管し、本文と一緒に保存できる公開 URL を返す。
 *
 * `entries.media_urls` への書き込みはここでは行わない。写真を選んだ時点ではまだエントリが
 * 存在しないこと（新規作成中）があり、URL を受け取ったクライアントが本文の保存に相乗りさせる
 * 方が、下書き段階の写真で孤児エントリを作らずに済むため。
 */
export class UploadEntryPhotoUsecase {
  constructor(private entryStorage: EntryStorageGateway) {}

  async execute(userId: string, input: UploadEntryPhotoInput): Promise<UploadEntryPhotoResponse> {
    const storagePath = await this.entryStorage.upload(
      userId,
      input.fileName,
      input.file,
      input.contentType,
    );

    return { storagePath, url: this.entryStorage.getPublicUrl(storagePath) };
  }
}
