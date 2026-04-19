'use client';

import { useCallback, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  type EditorSettings,
} from '@/features/entries/components/settings-drawer';

const FONT_SIZE_STORAGE_KEY = 'oryzae-editor-font-size';
const FONT_SIZE_MIN = 14;
const FONT_SIZE_MAX = 48;

const LINE_HEIGHT_STORAGE_KEY = 'oryzae-editor-line-height';
const LINE_HEIGHT_MIN = 1.0;
const LINE_HEIGHT_MAX = 2.5;

function readStoredFontSize(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    if (raw === null) return null;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) return null;
    if (n < FONT_SIZE_MIN || n > FONT_SIZE_MAX) return null;
    return n;
  } catch {
    return null;
  }
}

function writeStoredFontSize(value: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(value));
  } catch {
    // ignore quota / private-mode errors
  }
}

function readStoredLineHeight(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LINE_HEIGHT_STORAGE_KEY);
    if (raw === null) return null;
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n)) return null;
    if (n < LINE_HEIGHT_MIN || n > LINE_HEIGHT_MAX) return null;
    return n;
  } catch {
    return null;
  }
}

function writeStoredLineHeight(value: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LINE_HEIGHT_STORAGE_KEY, String(value));
  } catch {
    // ignore quota / private-mode errors
  }
}

function getInitialSettings(): EditorSettings {
  const next: EditorSettings = { ...DEFAULT_SETTINGS };
  const fontSize = readStoredFontSize();
  if (fontSize !== null) next.fontSize = fontSize;
  const lineHeight = readStoredLineHeight();
  if (lineHeight !== null) next.lineHeight = lineHeight;
  return next;
}

export function useEditorSettings(): [EditorSettings, (patch: Partial<EditorSettings>) => void] {
  const [settings, setSettings] = useState<EditorSettings>(getInitialSettings);

  const updateSettings = useCallback((patch: Partial<EditorSettings>) => {
    if (typeof patch.fontSize === 'number') {
      writeStoredFontSize(patch.fontSize);
    }
    if (typeof patch.lineHeight === 'number') {
      writeStoredLineHeight(patch.lineHeight);
    }
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  return [settings, updateSettings];
}
