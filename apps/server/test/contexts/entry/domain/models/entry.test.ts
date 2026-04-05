import { describe, expect, it } from 'vitest';
import { Entry } from '@/contexts/entry/domain/models/entry';

const generateId = () => 'test-id';

describe('Entry', () => {
  describe('create', () => {
    it('有効なパラメータで Entry を作成できる', () => {
      const result = Entry.create(
        { userId: 'user-1', content: 'Hello', mediaUrls: [] },
        generateId,
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.id).toBe('test-id');
        expect(result.value.userId).toBe('user-1');
        expect(result.value.content).toBe('Hello');
        expect(result.value.mediaUrls).toEqual([]);
      }
    });

    it('空文字の content で EMPTY_CONTENT エラーを返す', () => {
      const result = Entry.create({ userId: 'user-1', content: '', mediaUrls: [] }, generateId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('EMPTY_CONTENT');
      }
    });

    it('空白のみの content で EMPTY_CONTENT エラーを返す', () => {
      const result = Entry.create({ userId: 'user-1', content: '   ', mediaUrls: [] }, generateId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('EMPTY_CONTENT');
      }
    });

    it('100,000文字超の content で CONTENT_TOO_LONG エラーを返す', () => {
      const longContent = 'a'.repeat(100_001);
      const result = Entry.create(
        { userId: 'user-1', content: longContent, mediaUrls: [] },
        generateId,
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('CONTENT_TOO_LONG');
      }
    });

    it('100,000文字ちょうどの content は成功する', () => {
      const maxContent = 'a'.repeat(100_000);
      const result = Entry.create(
        { userId: 'user-1', content: maxContent, mediaUrls: [] },
        generateId,
      );
      expect(result.success).toBe(true);
    });
  });

  describe('fromProps / toProps', () => {
    it('Props から復元し、同じ Props に変換できる', () => {
      const props = {
        id: 'e-1',
        userId: 'u-1',
        content: 'test',
        mediaUrls: ['url1'],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };
      const entry = Entry.fromProps(props);
      expect(entry.toProps()).toEqual(props);
    });
  });

  describe('withContent', () => {
    const entry = Entry.fromProps({
      id: 'e-1',
      userId: 'u-1',
      content: 'original',
      mediaUrls: [],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });

    it('content を更新した新しい Entry を返す', () => {
      const result = entry.withContent('updated', ['new-url']);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.content).toBe('updated');
        expect(result.value.mediaUrls).toEqual(['new-url']);
        expect(result.value.id).toBe('e-1');
      }
    });

    it('元の Entry は変更されない（イミュータブル）', () => {
      entry.withContent('changed', []);
      expect(entry.content).toBe('original');
    });

    it('空文字の content でエラーを返す', () => {
      const result = entry.withContent('', []);
      expect(result.success).toBe(false);
    });
  });
});
