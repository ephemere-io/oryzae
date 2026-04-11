import { describe, expect, it } from 'vitest';
import { BoardCard } from '@/contexts/board/domain/models/board-card';

const generateId = () => 'test-card-id';

const validParams = {
  userId: 'user-1',
  cardType: 'entry',
  refId: 'ref-1',
  dateKey: '2026-04-11',
  viewType: 'daily',
  x: 100,
  y: 200,
  rotation: -3.5,
  width: 340,
  height: 280,
  zIndex: 1,
};

describe('BoardCard', () => {
  describe('create', () => {
    it('有効なパラメータで BoardCard を作成できる', () => {
      const result = BoardCard.create(validParams, generateId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.id).toBe('test-card-id');
        expect(result.value.userId).toBe('user-1');
        expect(result.value.cardType).toBe('entry');
        expect(result.value.refId).toBe('ref-1');
        expect(result.value.dateKey).toBe('2026-04-11');
        expect(result.value.viewType).toBe('daily');
        expect(result.value.x).toBe(100);
        expect(result.value.y).toBe(200);
        expect(result.value.rotation).toBe(-3.5);
        expect(result.value.width).toBe(340);
        expect(result.value.height).toBe(280);
        expect(result.value.zIndex).toBe(1);
      }
    });

    it('snippet タイプでも作成できる', () => {
      const result = BoardCard.create({ ...validParams, cardType: 'snippet' }, generateId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.cardType).toBe('snippet');
      }
    });

    it('weekly ビュータイプでも作成できる', () => {
      const result = BoardCard.create({ ...validParams, viewType: 'weekly' }, generateId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.viewType).toBe('weekly');
      }
    });

    it('無効な cardType で INVALID_CARD_TYPE エラーを返す', () => {
      const result = BoardCard.create({ ...validParams, cardType: 'invalid' }, generateId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_CARD_TYPE');
      }
    });

    it('無効な viewType で INVALID_VIEW_TYPE エラーを返す', () => {
      const result = BoardCard.create({ ...validParams, viewType: 'monthly' }, generateId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_VIEW_TYPE');
      }
    });

    it('空の refId で MISSING_REF_ID エラーを返す', () => {
      const result = BoardCard.create({ ...validParams, refId: '' }, generateId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('MISSING_REF_ID');
      }
    });

    it('空白のみの refId で MISSING_REF_ID エラーを返す', () => {
      const result = BoardCard.create({ ...validParams, refId: '   ' }, generateId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('MISSING_REF_ID');
      }
    });

    it('width が 120 未満で INVALID_DIMENSIONS エラーを返す', () => {
      const result = BoardCard.create({ ...validParams, width: 119 }, generateId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_DIMENSIONS');
      }
    });

    it('height が 120 未満で INVALID_DIMENSIONS エラーを返す', () => {
      const result = BoardCard.create({ ...validParams, height: 119 }, generateId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_DIMENSIONS');
      }
    });

    it('width/height が 120 ちょうどなら成功する', () => {
      const result = BoardCard.create({ ...validParams, width: 120, height: 120 }, generateId);
      expect(result.success).toBe(true);
    });
  });

  describe('fromProps / toProps', () => {
    it('Props から復元し、同じ Props に変換できる', () => {
      const props = {
        id: 'c-1',
        userId: 'u-1',
        cardType: 'entry' as const,
        refId: 'ref-1',
        dateKey: '2026-04-11',
        viewType: 'daily' as const,
        x: 10,
        y: 20,
        rotation: 5,
        width: 300,
        height: 200,
        zIndex: 3,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };
      const card = BoardCard.fromProps(props);
      expect(card.toProps()).toEqual(props);
    });
  });

  describe('withPosition', () => {
    const card = BoardCard.fromProps({
      id: 'c-1',
      userId: 'u-1',
      cardType: 'entry',
      refId: 'ref-1',
      dateKey: '2026-04-11',
      viewType: 'daily',
      x: 10,
      y: 20,
      rotation: 0,
      width: 300,
      height: 200,
      zIndex: 1,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });

    it('位置を更新した新しい BoardCard を返す', () => {
      const updated = card.withPosition(50, 60, -3);
      expect(updated.x).toBe(50);
      expect(updated.y).toBe(60);
      expect(updated.rotation).toBe(-3);
      expect(updated.id).toBe('c-1');
    });

    it('元の BoardCard は変更されない（イミュータブル）', () => {
      card.withPosition(999, 999, 45);
      expect(card.x).toBe(10);
      expect(card.y).toBe(20);
      expect(card.rotation).toBe(0);
    });
  });

  describe('withDimensions', () => {
    const card = BoardCard.fromProps({
      id: 'c-1',
      userId: 'u-1',
      cardType: 'entry',
      refId: 'ref-1',
      dateKey: '2026-04-11',
      viewType: 'daily',
      x: 10,
      y: 20,
      rotation: 0,
      width: 300,
      height: 200,
      zIndex: 1,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });

    it('サイズを更新した新しい BoardCard を返す', () => {
      const result = card.withDimensions(400, 350);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.width).toBe(400);
        expect(result.value.height).toBe(350);
      }
    });

    it('120 未満の width で INVALID_DIMENSIONS エラーを返す', () => {
      const result = card.withDimensions(119, 200);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_DIMENSIONS');
      }
    });

    it('元の BoardCard は変更されない（イミュータブル）', () => {
      card.withDimensions(500, 500);
      expect(card.width).toBe(300);
      expect(card.height).toBe(200);
    });
  });

  describe('withZIndex', () => {
    const card = BoardCard.fromProps({
      id: 'c-1',
      userId: 'u-1',
      cardType: 'entry',
      refId: 'ref-1',
      dateKey: '2026-04-11',
      viewType: 'daily',
      x: 10,
      y: 20,
      rotation: 0,
      width: 300,
      height: 200,
      zIndex: 1,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });

    it('zIndex を更新した新しい BoardCard を返す', () => {
      const updated = card.withZIndex(10);
      expect(updated.zIndex).toBe(10);
      expect(updated.id).toBe('c-1');
    });

    it('元の BoardCard は変更されない（イミュータブル）', () => {
      card.withZIndex(99);
      expect(card.zIndex).toBe(1);
    });
  });
});
