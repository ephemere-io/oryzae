import { describe, expect, it } from 'vitest';
import { EntrySnapshot } from './entry-snapshot';

const generateId = () => 'snap-id';

describe('EntrySnapshot', () => {
  describe('create', () => {
    it('パラメータから EntrySnapshot を作成できる', () => {
      const snapshot = EntrySnapshot.create(
        {
          entryId: 'entry-1',
          content: 'test content',
          editorType: 'typetrace',
          editorVersion: '1.0.0',
          extension: { foo: 'bar' },
        },
        generateId,
      );
      expect(snapshot.id).toBe('snap-id');
      expect(snapshot.entryId).toBe('entry-1');
      expect(snapshot.editorType).toBe('typetrace');
      expect(snapshot.extension).toEqual({ foo: 'bar' });
    });
  });

  describe('fromProps / toProps', () => {
    it('Props から復元し、同じ Props に変換できる', () => {
      const props = {
        id: 's-1',
        entryId: 'e-1',
        content: 'test',
        editorType: 'minimal',
        editorVersion: '1.0.0',
        extension: {},
        createdAt: '2026-01-01T00:00:00Z',
      };
      const snapshot = EntrySnapshot.fromProps(props);
      expect(snapshot.toProps()).toEqual(props);
    });
  });
});
