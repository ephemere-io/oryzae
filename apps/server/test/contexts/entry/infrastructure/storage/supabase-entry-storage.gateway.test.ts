import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseEntryStorageGateway } from '@/contexts/entry/infrastructure/storage/supabase-entry-storage.gateway';

/**
 * 実 Storage は叩かず、バケット名とパスの組み立てを固定する。
 * パス先頭が userId であることは Storage RLS (00023) が依存している性質なので、
 * DB を用意しない範囲でもここだけは回帰を検出できるようにしておく。
 */
describe('SupabaseEntryStorageGateway', () => {
  const uploadFn = vi.fn();
  const createSignedUrlFn = vi.fn();
  const createSignedUrlsFn = vi.fn();
  const removeFn = vi.fn();
  const fromFn = vi.fn(() => ({
    upload: uploadFn,
    createSignedUrl: createSignedUrlFn,
    createSignedUrls: createSignedUrlsFn,
    remove: removeFn,
  }));

  // @type-assertion-allowed: SupabaseClient は多数のメソッドを持つが、この gateway が
  // 触るのは storage.from() のみ。テストで必要な最小限だけスタブする。
  const supabase = { storage: { from: fromFn } } as unknown as SupabaseClient;
  const gateway = new SupabaseEntryStorageGateway(supabase);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T00:00:00Z'));
    uploadFn.mockReset().mockResolvedValue({ error: null });
    createSignedUrlFn.mockReset().mockResolvedValue({
      data: { signedUrl: 'https://cdn.example/signed/p.jpg?token=abc' },
      error: null,
    });
    createSignedUrlsFn.mockReset().mockResolvedValue({ data: [], error: null });
    removeFn.mockReset().mockResolvedValue({ error: null });
    fromFn.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('entry-photos バケットの userId 配下に保存し storagePath を返す', async () => {
    const storagePath = await gateway.upload(
      'user-1',
      'note.jpg',
      new ArrayBuffer(8),
      'image/jpeg',
    );

    expect(fromFn).toHaveBeenCalledWith('entry-photos');
    // RLS が (storage.foldername(name))[1] = auth.uid() を見るため、先頭は必ず userId。
    expect(storagePath.startsWith('user-1/')).toBe(true);
    expect(storagePath).toBe(`user-1/${Date.parse('2026-08-24T00:00:00Z')}-note.jpg`);
    expect(uploadFn).toHaveBeenCalledWith(storagePath, expect.anything(), {
      contentType: 'image/jpeg',
      upsert: false,
    });
  });

  it('既存ファイルを上書きしない（upsert: false）', async () => {
    await gateway.upload('user-1', 'note.jpg', new ArrayBuffer(4), 'image/jpeg');

    expect(uploadFn.mock.calls[0][2]).toMatchObject({ upsert: false });
  });

  it('upload が失敗したら投げる', async () => {
    uploadFn.mockResolvedValue({ error: new Error('quota exceeded') });

    await expect(
      gateway.upload('user-1', 'note.jpg', new ArrayBuffer(4), 'image/jpeg'),
    ).rejects.toThrow('quota exceeded');
  });

  // バケットは private（00023 / #504）。公開 URL は存在せず、都度署名する。
  it('署名付き URL を返す', async () => {
    expect(await gateway.getSignedUrl('user-1/1-note.jpg')).toBe(
      'https://cdn.example/signed/p.jpg?token=abc',
    );
    expect(createSignedUrlFn).toHaveBeenCalledWith('user-1/1-note.jpg', 3600);
  });

  it('署名に失敗したら投げる（公開 URL へフォールバックしない）', async () => {
    createSignedUrlFn.mockResolvedValue({ data: null, error: new Error('not found') });

    await expect(gateway.getSignedUrl('user-1/1-note.jpg')).rejects.toThrow('not found');
  });

  it('まとめて署名し、パス→URL の Map を返す', async () => {
    createSignedUrlsFn.mockResolvedValue({
      data: [
        { path: 'user-1/a.jpg', signedUrl: 'https://cdn.example/a?token=1' },
        // 個別に失敗したパスは signedUrl が欠ける。その写真だけ落とす。
        { path: 'user-1/b.jpg', signedUrl: null },
      ],
      error: null,
    });

    const urls = await gateway.getSignedUrls(['user-1/a.jpg', 'user-1/b.jpg']);

    expect(urls.get('user-1/a.jpg')).toBe('https://cdn.example/a?token=1');
    expect(urls.has('user-1/b.jpg')).toBe(false);
  });

  it('空配列なら API を呼ばない', async () => {
    expect((await gateway.getSignedUrls([])).size).toBe(0);
    expect(createSignedUrlsFn).not.toHaveBeenCalled();
  });

  it('delete は remove に委譲し、失敗したら投げる', async () => {
    await gateway.delete('user-1/1-note.jpg');
    expect(removeFn).toHaveBeenCalledWith(['user-1/1-note.jpg']);

    removeFn.mockResolvedValue({ error: new Error('not found') });
    await expect(gateway.delete('user-1/1-note.jpg')).rejects.toThrow('not found');
  });
});
