'use client';

import { useCallback, useEffect, useState } from 'react';
import { LANDING_I18N, LANDING_TITLES } from '../i18n';
import { isLandingLang, type LandingLang } from '../types';

export const LANDING_LANG_STORAGE_KEY = 'oryzae-lp-lang';

function readStoredLang(): LandingLang | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = window.localStorage.getItem(LANDING_LANG_STORAGE_KEY);
    if (saved && isLandingLang(saved)) return saved;
  } catch {
    return null;
  }
  return null;
}

function readUrlLang(): LandingLang | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const q = url.searchParams.get('lang');
  if (q && isLandingLang(q)) return q;
  return null;
}

function readNavigatorLang(): LandingLang {
  if (typeof navigator === 'undefined') return 'ja';
  const langs =
    navigator.languages && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language || ''];
  for (const l of langs) {
    if (!l) continue;
    const code = l.toLowerCase().split('-')[0];
    if (code === 'ja') return 'ja';
    if (code === 'en') return 'en';
  }
  return 'ja';
}

export function detectInitialLang(): LandingLang {
  return readStoredLang() ?? readUrlLang() ?? readNavigatorLang();
}

interface UseLandingI18n {
  lang: LandingLang;
  setLang: (lang: LandingLang) => void;
  t: (key: string) => string;
}

export function useLandingI18n(): UseLandingI18n {
  const [lang, setLangState] = useState<LandingLang>('ja');

  useEffect(() => {
    setLangState(detectInitialLang());
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = lang;
    document.title = LANDING_TITLES[lang];
  }, [lang]);

  const setLang = useCallback((next: LandingLang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(LANDING_LANG_STORAGE_KEY, next);
    } catch {
      // ignore storage failures (private browsing, quota)
    }
  }, []);

  const t = useCallback(
    (key: string) => {
      const dict = LANDING_I18N[lang];
      return dict[key] ?? key;
    },
    [lang],
  );

  return { lang, setLang, t };
}
