import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  loadCachedEffects,
  saveCachedEffects,
} from '@/features/entries/utils/editor-effects-cache';

describe('editor-effects-cache', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('returns null when no entry id is provided', () => {
    expect(loadCachedEffects(undefined)).toBeNull();
  });

  it('saves and loads an effects payload', () => {
    saveCachedEffects('e-1', { version: 1, textSpans: [] });
    expect(loadCachedEffects('e-1')).toEqual({ version: 1, textSpans: [] });
  });

  it('returns null when localStorage is empty for the id', () => {
    expect(loadCachedEffects('does-not-exist')).toBeNull();
  });

  it('removes the entry when saving null', () => {
    saveCachedEffects('e-1', { version: 1, textSpans: [] });
    saveCachedEffects('e-1', null);
    expect(loadCachedEffects('e-1')).toBeNull();
  });

  it('returns null when stored payload is invalid JSON', () => {
    window.localStorage.setItem('oryzae-entry-effects:e-1', 'not-json');
    expect(loadCachedEffects('e-1')).toBeNull();
  });

  it('drops cache that does not match the current schema (e.g. legacy {t, duration} time variant)', () => {
    // Old shape from before Issue #332 v2 — must NOT be returned because apply
    // would write `style.fontSize = "undefinedpx"` and the text would render at
    // the inherited (smaller) size.
    window.localStorage.setItem(
      'oryzae-entry-effects:e-old',
      JSON.stringify({
        version: 1,
        textSpans: [{ kind: 'time', start: 0, end: 1, mode: 'fontSize', t: 0.5, duration: 200 }],
      }),
    );
    expect(loadCachedEffects('e-old')).toBeNull();
    // …and the stale entry is purged so it doesn't keep failing on every load.
    expect(window.localStorage.getItem('oryzae-entry-effects:e-old')).toBeNull();
  });

  it('returns the parsed effects when the cache matches the schema', () => {
    window.localStorage.setItem(
      'oryzae-entry-effects:e-new',
      JSON.stringify({
        version: 1,
        textSpans: [{ kind: 'time', start: 0, end: 1, mode: 'fontSize', fontSize: 24 }],
      }),
    );
    expect(loadCachedEffects('e-new')).toEqual({
      version: 1,
      textSpans: [{ kind: 'time', start: 0, end: 1, mode: 'fontSize', fontSize: 24 }],
    });
  });
});
