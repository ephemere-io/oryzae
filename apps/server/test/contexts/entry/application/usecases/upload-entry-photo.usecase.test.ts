import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UploadEntryPhotoUsecase } from '@/contexts/entry/application/usecases/upload-entry-photo.usecase';
import type { EntryStorageGateway } from '@/contexts/entry/domain/gateways/entry-storage.gateway';

describe('UploadEntryPhotoUsecase', () => {
  let entryStorage: EntryStorageGateway;
  let usecase: UploadEntryPhotoUsecase;

  beforeEach(() => {
    entryStorage = {
      upload: vi.fn().mockResolvedValue('user-1/1700000000000-note.jpg'),
      getPublicUrl: vi.fn().mockReturnValue('https://cdn.example/entry-photos/user-1/note.jpg'),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    usecase = new UploadEntryPhotoUsecase(entryStorage);
  });

  it('Storage に保管し storagePath と公開 URL を返す', async () => {
    const file = new ArrayBuffer(8);

    const result = await usecase.execute('user-1', {
      file,
      fileName: 'note.jpg',
      contentType: 'image/jpeg',
    });

    expect(result).toEqual({
      storagePath: 'user-1/1700000000000-note.jpg',
      url: 'https://cdn.example/entry-photos/user-1/note.jpg',
    });
    expect(entryStorage.upload).toHaveBeenCalledWith('user-1', 'note.jpg', file, 'image/jpeg');
    expect(entryStorage.getPublicUrl).toHaveBeenCalledWith('user-1/1700000000000-note.jpg');
  });

  it('公開 URL は upload が返した storagePath から引く（入力ファイル名からではない）', async () => {
    vi.mocked(entryStorage.upload).mockResolvedValue('user-1/9-renamed.jpg');

    await usecase.execute('user-1', {
      file: new ArrayBuffer(4),
      fileName: 'original.jpg',
      contentType: 'image/jpeg',
    });

    expect(entryStorage.getPublicUrl).toHaveBeenCalledWith('user-1/9-renamed.jpg');
  });

  it('Storage が失敗したらそのまま伝播する', async () => {
    vi.mocked(entryStorage.upload).mockRejectedValue(new Error('storage down'));

    await expect(
      usecase.execute('user-1', {
        file: new ArrayBuffer(4),
        fileName: 'note.jpg',
        contentType: 'image/jpeg',
      }),
    ).rejects.toThrow('storage down');
  });
});
