'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  type EditorSettings,
} from '@/features/entries/components/settings-drawer';

const STORAGE_KEY = 'oryzae-editor-settings';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSettings(raw: Record<string, unknown>): EditorSettings {
  const d = DEFAULT_SETTINGS;
  return {
    writingMode:
      raw.writingMode === 'vertical' || raw.writingMode === 'horizontal'
        ? raw.writingMode
        : d.writingMode,
    fontFamily:
      raw.fontFamily === 'serif' || raw.fontFamily === 'sans' ? raw.fontFamily : d.fontFamily,
    fontSize: typeof raw.fontSize === 'number' ? raw.fontSize : d.fontSize,
    lineHeight: typeof raw.lineHeight === 'number' ? raw.lineHeight : d.lineHeight,
    timeInscriptionEnabled:
      typeof raw.timeInscriptionEnabled === 'boolean'
        ? raw.timeInscriptionEnabled
        : d.timeInscriptionEnabled,
    timeInscriptionMode:
      raw.timeInscriptionMode === 'fontSize' ||
      raw.timeInscriptionMode === 'fontWeight' ||
      raw.timeInscriptionMode === 'pressureBleed'
        ? raw.timeInscriptionMode
        : d.timeInscriptionMode,
    eraserTraceEnabled:
      typeof raw.eraserTraceEnabled === 'boolean' ? raw.eraserTraceEnabled : d.eraserTraceEnabled,
    ampEnabled: typeof raw.ampEnabled === 'boolean' ? raw.ampEnabled : d.ampEnabled,
    voiceEnabled: typeof raw.voiceEnabled === 'boolean' ? raw.voiceEnabled : d.voiceEnabled,
    ghostEnabled: typeof raw.ghostEnabled === 'boolean' ? raw.ghostEnabled : d.ghostEnabled,
    ghostMode: raw.ghostMode === 'block' || raw.ghostMode === 'dust' ? raw.ghostMode : d.ghostMode,
    ghostSize: typeof raw.ghostSize === 'number' ? raw.ghostSize : d.ghostSize,
    ghostScatter: typeof raw.ghostScatter === 'number' ? raw.ghostScatter : d.ghostScatter,
    ghostBlurStart: typeof raw.ghostBlurStart === 'number' ? raw.ghostBlurStart : d.ghostBlurStart,
    ghostBlurEnd: typeof raw.ghostBlurEnd === 'number' ? raw.ghostBlurEnd : d.ghostBlurEnd,
    ghostDuration: typeof raw.ghostDuration === 'number' ? raw.ghostDuration : d.ghostDuration,
  };
}

function loadInitial(): EditorSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return DEFAULT_SETTINGS;
    return parseSettings(parsed);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function useEditorSettings(): [EditorSettings, (patch: Partial<EditorSettings>) => void] {
  const [settings, setSettings] = useState<EditorSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(loadInitial());
  }, []);

  const updateSettings = useCallback((patch: Partial<EditorSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // storage unavailable (private mode, quota) — keep in-memory only
      }
      return next;
    });
  }, []);

  return [settings, updateSettings];
}
