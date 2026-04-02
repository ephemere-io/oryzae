import { describe, it, expect } from 'vitest';
import { resolveExtension } from './snapshot-restoration.service';
import type { EntrySnapshot } from '../models/entry-snapshot';

describe('resolveExtension', () => {
  const baseSnapshot: EntrySnapshot = {
    id: 'snap-1',
    entryId: 'entry-1',
    content: 'test',
    editorType: 'typetrace',
    editorVersion: '1.0.0',
    extension: { erasureTraces: [], averageWPM: 6.64 },
    createdAt: '2026-03-15T10:30:00Z',
  };

  it('snapshot が null なら null を返す', () => {
    expect(resolveExtension(null, 'typetrace')).toBeNull();
  });

  it('editorType が一致すれば extension を返す', () => {
    const result = resolveExtension(baseSnapshot, 'typetrace');
    expect(result).toEqual(baseSnapshot.extension);
  });

  it('editorType が不一致なら null を返す', () => {
    const result = resolveExtension(baseSnapshot, 'minimal');
    expect(result).toBeNull();
  });
});
