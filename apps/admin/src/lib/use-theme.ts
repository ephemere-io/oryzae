'use client';

import { useCallback, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'oryzae_admin_theme';

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function useTheme() {
  // Issue #362: SSR と client 初回描画を必ず同じ値('dark')にしてハイドレーション
  // 不一致(React #418)を防ぐ。実テーマはマウント後に反映する（見た目のクラスは
  // <head> の theme-init.js が hydration 前に適用済みなので、ここで上書きしない）。
  const [theme, setThemeState] = useState<Theme>('dark');
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    setThemeState(getInitialTheme());
    setSynced(true);
  }, []);

  useEffect(() => {
    if (synced) applyTheme(theme);
  }, [theme, synced]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return { theme, setTheme, toggle };
}
