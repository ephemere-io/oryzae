'use client';

import { useCallback, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  type EditorSettings,
  type FermentationOverlayPreference,
} from '@/features/entries/components/settings-drawer';

const FONT_SIZE_STORAGE_KEY = 'oryzae-editor-font-size';
const FONT_SIZE_MIN = 14;
const FONT_SIZE_MAX = 48;

const LINE_HEIGHT_STORAGE_KEY = 'oryzae-editor-line-height';
const LINE_HEIGHT_MIN = 1.0;
const LINE_HEIGHT_MAX = 2.5;

const FOCUS_MODE_STORAGE_KEY = 'oryzae-editor-focus-mode';

const FERMENTATION_OVERLAY_PREFERENCE_KEY = 'oryzae-editor-fermentation-overlay-preference';

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

function readStoredFocusMode(): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(FOCUS_MODE_STORAGE_KEY);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return null;
  } catch {
    return null;
  }
}

function writeStoredFocusMode(value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FOCUS_MODE_STORAGE_KEY, String(value));
  } catch {
    // ignore quota / private-mode errors
  }
}

function readStoredFermentationOverlayPreference(): FermentationOverlayPreference | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(FERMENTATION_OVERLAY_PREFERENCE_KEY);
    if (raw === 'ask' || raw === 'always' || raw === 'never') return raw;
    return null;
  } catch {
    return null;
  }
}

function writeStoredFermentationOverlayPreference(value: FermentationOverlayPreference): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FERMENTATION_OVERLAY_PREFERENCE_KEY, value);
  } catch {
    // ignore quota / private-mode errors
  }
}

function getInitialSettings(locale: string | undefined): EditorSettings {
  const next: EditorSettings = { ...DEFAULT_SETTINGS };
  // 英語ロケールでサインアップ／利用しているユーザーは横書きをデフォルトにする (issue #269)
  // 縦書きは日本語ジャーナリングを念頭にした既定値で、英語話者には不自然なため。
  // 韓国語 (ko) も横書き既定。中国語 (zh) は縦書きが伝統的に成立するため日本語と同じ既定 (issue #308)。
  if (locale === 'en' || locale === 'ko') next.writingMode = 'horizontal';
  const fontSize = readStoredFontSize();
  if (fontSize !== null) next.fontSize = fontSize;
  const lineHeight = readStoredLineHeight();
  if (lineHeight !== null) next.lineHeight = lineHeight;
  const focusMode = readStoredFocusMode();
  if (focusMode !== null) next.focusModeEnabled = focusMode;
  const overlayPref = readStoredFermentationOverlayPreference();
  if (overlayPref !== null) next.fermentationOverlayPreference = overlayPref;
  return next;
}

export function useEditorSettings(
  locale?: string,
): [EditorSettings, (patch: Partial<EditorSettings>) => void] {
  const [settings, setSettings] = useState<EditorSettings>(() => getInitialSettings(locale));

  const updateSettings = useCallback((patch: Partial<EditorSettings>) => {
    if (typeof patch.fontSize === 'number') {
      writeStoredFontSize(patch.fontSize);
    }
    if (typeof patch.lineHeight === 'number') {
      writeStoredLineHeight(patch.lineHeight);
    }
    if (typeof patch.focusModeEnabled === 'boolean') {
      writeStoredFocusMode(patch.focusModeEnabled);
    }
    if (
      patch.fermentationOverlayPreference === 'ask' ||
      patch.fermentationOverlayPreference === 'always' ||
      patch.fermentationOverlayPreference === 'never'
    ) {
      writeStoredFermentationOverlayPreference(patch.fermentationOverlayPreference);
    }
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  return [settings, updateSettings];
}
