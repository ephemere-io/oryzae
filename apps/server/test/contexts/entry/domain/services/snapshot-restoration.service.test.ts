import { describe, expect, it } from 'vitest';
import { EntrySnapshot } from '@/contexts/entry/domain/models/entry-snapshot';
import { resolveExtension } from '@/contexts/entry/domain/services/snapshot-restoration.service';

describe('resolveExtension', () => {
  const baseSnapshot = EntrySnapshot.fromProps({
    id: 'snap-1',
    entryId: 'entry-1',
    content: 'test',
    editorType: 'typetrace',
    editorVersion: '1.0.0',
    extension: { erasureTraces: [], averageWPM: 6.64 },
    createdAt: '2026-03-15T10:30:00Z',
  });

  it('snapshot が null なら no-snapshot エラーを返す', () => {
    const result = resolveExtension(null, 'typetrace');
    expect(result).toEqual({ success: false, error: 'no-snapshot' });
  });

  it('editorType が一致すれば extension を返す', () => {
    const result = resolveExtension(baseSnapshot, 'typetrace');
    expect(result).toEqual({
      success: true,
      value: baseSnapshot.extension,
    });
  });

  it('editorType が不一致なら editor-mismatch エラーを返す', () => {
    const result = resolveExtension(baseSnapshot, 'minimal');
    expect(result).toEqual({ success: false, error: 'editor-mismatch' });
  });
});
