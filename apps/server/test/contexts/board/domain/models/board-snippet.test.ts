import { describe, expect, it } from 'vitest';
import { BoardSnippet } from '@/contexts/board/domain/models/board-snippet';

const generateId = () => 'test-snippet-id';

describe('BoardSnippet', () => {
  describe('create', () => {
    it('有効なテキストで BoardSnippet を作成できる', () => {
      const result = BoardSnippet.create({ userId: 'user-1', text: '重要な気づき' }, generateId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.id).toBe('test-snippet-id');
        expect(result.value.userId).toBe('user-1');
        expect(result.value.text).toBe('重要な気づき');
      }
    });

    it('空文字のテキストで EMPTY_TEXT エラーを返す', () => {
      const result = BoardSnippet.create({ userId: 'user-1', text: '' }, generateId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('EMPTY_TEXT');
      }
    });

    it('空白のみのテキストで EMPTY_TEXT エラーを返す', () => {
      const result = BoardSnippet.create({ userId: 'user-1', text: '   ' }, generateId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('EMPTY_TEXT');
      }
    });

    it('51文字以上のテキストで TEXT_TOO_LONG エラーを返す', () => {
      const longText = 'a'.repeat(51);
      const result = BoardSnippet.create({ userId: 'user-1', text: longText }, generateId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('TEXT_TOO_LONG');
      }
    });

    it('50文字ちょうどのテキストは成功する', () => {
      const maxText = 'a'.repeat(50);
      const result = BoardSnippet.create({ userId: 'user-1', text: maxText }, generateId);
      expect(result.success).toBe(true);
    });
  });

  describe('fromProps / toProps', () => {
    it('Props から復元し、同じ Props に変換できる', () => {
      const props = {
        id: 's-1',
        userId: 'u-1',
        text: 'テスト',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };
      const snippet = BoardSnippet.fromProps(props);
      expect(snippet.toProps()).toEqual(props);
    });
  });

  describe('withText', () => {
    const snippet = BoardSnippet.fromProps({
      id: 's-1',
      userId: 'u-1',
      text: 'オリジナル',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });

    it('テキストを更新した新しい BoardSnippet を返す', () => {
      const result = snippet.withText('更新後');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.text).toBe('更新後');
        expect(result.value.id).toBe('s-1');
      }
    });

    it('空文字で EMPTY_TEXT エラーを返す', () => {
      const result = snippet.withText('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('EMPTY_TEXT');
      }
    });

    it('51文字で TEXT_TOO_LONG エラーを返す', () => {
      const result = snippet.withText('a'.repeat(51));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('TEXT_TOO_LONG');
      }
    });

    it('元の BoardSnippet は変更されない（イミュータブル）', () => {
      snippet.withText('変更');
      expect(snippet.text).toBe('オリジナル');
    });
  });
});
