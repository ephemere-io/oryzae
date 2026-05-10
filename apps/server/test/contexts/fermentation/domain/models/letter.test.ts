import { describe, expect, it } from 'vitest';
import { Letter } from '@/contexts/fermentation/domain/models/letter';

const generateId = () => 'lt-id';

describe('Letter', () => {
  describe('create', () => {
    it('新規作成時の jar 位置は null', () => {
      const l = Letter.create('fr-1', 'こんにちは', generateId);
      expect(l.id).toBe('lt-id');
      expect(l.fermentationResultId).toBe('fr-1');
      expect(l.bodyText).toBe('こんにちは');
      expect(l.jarX).toBeNull();
      expect(l.jarY).toBeNull();
    });
  });

  describe('withJarPosition', () => {
    const base = Letter.fromProps({
      id: 'lt-1',
      fermentationResultId: 'fr-1',
      bodyText: 'body',
      jarX: null,
      jarY: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });

    it('jar 位置を設定した新インスタンスを返す（元は不変）', () => {
      const moved = base.withJarPosition(50, 50);
      expect(moved.jarX).toBe(50);
      expect(moved.jarY).toBe(50);
      expect(base.jarX).toBeNull();
      expect(base.jarY).toBeNull();
    });
  });

  describe('fromProps / toProps', () => {
    it('Props ラウンドトリップが一致する', () => {
      const props = {
        id: 'lt-1',
        fermentationResultId: 'fr-1',
        bodyText: 'body',
        jarX: 0,
        jarY: 100,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };
      expect(Letter.fromProps(props).toProps()).toEqual(props);
    });
  });
});
