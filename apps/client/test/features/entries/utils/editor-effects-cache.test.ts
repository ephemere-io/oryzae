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
});
