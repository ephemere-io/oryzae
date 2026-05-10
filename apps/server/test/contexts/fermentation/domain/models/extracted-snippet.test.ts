import { describe, expect, it } from 'vitest';
import { ExtractedSnippet } from '@/contexts/fermentation/domain/models/extracted-snippet';

const generateId = () => 'sn-id';

describe('ExtractedSnippet', () => {
  describe('create', () => {
    it('正しい snippetType なら ok を返し、jar 位置は null になる', () => {
      const result = ExtractedSnippet.create(
        {
          fermentationResultId: 'fr-1',
          snippetType: 'core',
          originalText: 'text',
          sourceDate: '2026-01-01',
          selectionReason: 'why',
        },
        generateId,
      );
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.value.snippetType).toBe('core');
      expect(result.value.jarX).toBeNull();
      expect(result.value.jarY).toBeNull();
    });

    it('不正な snippetType なら err を返す', () => {
      const result = ExtractedSnippet.create(
        {
          fermentationResultId: 'fr-1',
          // @type-assertion-allowed: テスト用に意図的に不正な値を渡して検証する
          snippetType: 'invalid' as 'core',
          originalText: 'text',
          sourceDate: '2026-01-01',
          selectionReason: 'why',
        },
        generateId,
      );
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.type).toBe('INVALID_SNIPPET_TYPE');
    });
  });

  describe('withJarPosition', () => {
    const base = ExtractedSnippet.fromProps({
      id: 'sn-1',
      fermentationResultId: 'fr-1',
      snippetType: 'core',
      originalText: 'text',
      sourceDate: '2026-01-01',
      selectionReason: 'why',
      jarX: null,
      jarY: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });

    it('jar 位置を設定した新インスタンスを返す（元は不変）', () => {
      const moved = base.withJarPosition(33.3, 66.6);
      expect(moved.jarX).toBe(33.3);
      expect(moved.jarY).toBe(66.6);
      expect(base.jarX).toBeNull();
      expect(base.jarY).toBeNull();
    });
  });

  describe('fromProps / toProps', () => {
    it('Props ラウンドトリップが一致する', () => {
      const props = {
        id: 'sn-1',
        fermentationResultId: 'fr-1',
        snippetType: 'deepen' as const,
        originalText: 'text',
        sourceDate: '2026-01-01',
        selectionReason: 'why',
        jarX: 25,
        jarY: 75,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };
      expect(ExtractedSnippet.fromProps(props).toProps()).toEqual(props);
    });
  });
});
