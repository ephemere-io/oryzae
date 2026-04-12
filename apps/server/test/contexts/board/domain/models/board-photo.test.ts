import { describe, expect, it } from 'vitest';
import { BoardPhoto } from '@/contexts/board/domain/models/board-photo';

const generateId = () => 'test-photo-id';

describe('BoardPhoto', () => {
  describe('create', () => {
    it('有効なパラメータで BoardPhoto を作成できる', () => {
      const result = BoardPhoto.create(
        { userId: 'user-1', storagePath: 'user-1/photo.jpg', caption: '朝の風景' },
        generateId,
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.id).toBe('test-photo-id');
        expect(result.value.storagePath).toBe('user-1/photo.jpg');
        expect(result.value.caption).toBe('朝の風景');
      }
    });

    it('空の storagePath で EMPTY_STORAGE_PATH エラーを返す', () => {
      const result = BoardPhoto.create(
        { userId: 'user-1', storagePath: '', caption: '' },
        generateId,
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('EMPTY_STORAGE_PATH');
      }
    });

    it('21文字以上の caption で CAPTION_TOO_LONG エラーを返す', () => {
      const result = BoardPhoto.create(
        { userId: 'user-1', storagePath: 'path.jpg', caption: 'a'.repeat(21) },
        generateId,
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('CAPTION_TOO_LONG');
      }
    });

    it('20文字ちょうどの caption は成功する', () => {
      const result = BoardPhoto.create(
        { userId: 'user-1', storagePath: 'path.jpg', caption: 'a'.repeat(20) },
        generateId,
      );
      expect(result.success).toBe(true);
    });

    it('空の caption は成功する', () => {
      const result = BoardPhoto.create(
        { userId: 'user-1', storagePath: 'path.jpg', caption: '' },
        generateId,
      );
      expect(result.success).toBe(true);
    });
  });

  describe('fromProps / toProps', () => {
    it('Props から復元し、同じ Props に変換できる', () => {
      const props = {
        id: 'p-1',
        userId: 'u-1',
        storagePath: 'u-1/photo.jpg',
        caption: 'テスト',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };
      const photo = BoardPhoto.fromProps(props);
      expect(photo.toProps()).toEqual(props);
    });
  });
});
