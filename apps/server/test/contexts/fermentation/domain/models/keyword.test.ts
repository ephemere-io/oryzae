import { describe, expect, it } from 'vitest';
import { Keyword } from '@/contexts/fermentation/domain/models/keyword';

const generateId = () => 'kw-id';

describe('Keyword', () => {
  describe('create', () => {
    it('新規作成時の jar 位置は null', () => {
      const k = Keyword.create('fr-1', 'koji', '麹についての記述', generateId);
      expect(k.id).toBe('kw-id');
      expect(k.fermentationResultId).toBe('fr-1');
      expect(k.keyword).toBe('koji');
      expect(k.description).toBe('麹についての記述');
      expect(k.jarX).toBeNull();
      expect(k.jarY).toBeNull();
    });
  });

  describe('withJarPosition', () => {
    const base = Keyword.fromProps({
      id: 'kw-1',
      fermentationResultId: 'fr-1',
      keyword: 'k',
      description: 'd',
      jarX: null,
      jarY: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });

    it('jar 位置を設定した新インスタンスを返す（元は不変）', () => {
      const moved = base.withJarPosition(20.5, 80);
      expect(moved.jarX).toBe(20.5);
      expect(moved.jarY).toBe(80);
      expect(base.jarX).toBeNull();
      expect(base.jarY).toBeNull();
    });

    it('updatedAt を更新する', () => {
      const moved = base.withJarPosition(0, 0);
      expect(moved.updatedAt).not.toBe(base.updatedAt);
    });
  });

  describe('fromProps / toProps', () => {
    it('Props ラウンドトリップが一致する', () => {
      const props = {
        id: 'kw-1',
        fermentationResultId: 'fr-1',
        keyword: 'k',
        description: 'd',
        jarX: 12.5,
        jarY: 87.5,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };
      expect(Keyword.fromProps(props).toProps()).toEqual(props);
    });
  });
});
