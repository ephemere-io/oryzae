import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  detectInitialLang,
  LANDING_LANG_STORAGE_KEY,
  useLandingI18n,
} from '@/features/landing/hooks/use-landing-i18n';

describe('detectInitialLang', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('prefers a stored lang over navigator', () => {
    localStorage.setItem(LANDING_LANG_STORAGE_KEY, 'en');
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['ja-JP']);
    expect(detectInitialLang()).toBe('en');
  });

  it('ignores unsupported stored lang and falls back to navigator', () => {
    localStorage.setItem(LANDING_LANG_STORAGE_KEY, 'fr');
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['ja-JP']);
    expect(detectInitialLang()).toBe('ja');
  });

  it('uses ?lang= query param when no stored lang', () => {
    window.history.replaceState({}, '', '/?lang=en');
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['ja-JP']);
    expect(detectInitialLang()).toBe('en');
  });

  it('falls back to navigator language', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US']);
    expect(detectInitialLang()).toBe('en');
  });

  it('defaults to ja for unknown navigator languages', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fr-FR']);
    expect(detectInitialLang()).toBe('ja');
  });
});

describe('useLandingI18n', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    window.history.replaceState({}, '', '/');
    document.documentElement.lang = '';
    document.title = '';
  });

  it('returns translated strings via t()', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US']);
    const { result } = renderHook(() => useLandingI18n());
    await waitFor(() => expect(result.current.lang).toBe('en'));
    expect(result.current.t('nav.concept')).toBe('Concept');
  });

  it('falls back to the key when missing', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['ja-JP']);
    const { result } = renderHook(() => useLandingI18n());
    await waitFor(() => expect(result.current.lang).toBe('ja'));
    expect(result.current.t('nonexistent.key')).toBe('nonexistent.key');
  });

  it('setLang persists choice and updates document.title and lang', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['ja-JP']);
    const { result } = renderHook(() => useLandingI18n());
    await waitFor(() => expect(result.current.lang).toBe('ja'));

    act(() => {
      result.current.setLang('en');
    });

    await waitFor(() => expect(result.current.lang).toBe('en'));
    expect(localStorage.getItem(LANDING_LANG_STORAGE_KEY)).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.title).toBe('Oryzae — Let your writing ferment.');
  });
});
