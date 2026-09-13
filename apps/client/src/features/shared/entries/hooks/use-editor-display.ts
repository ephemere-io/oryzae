'use client';

import { useCallback, useEffect, useState } from 'react';
import type { EditorDisplay, EditorFontFamily, EditorScale, EditorSpacing } from '../types';

export const DEFAULT_EDITOR_DISPLAY: EditorDisplay = {
  fontFamily: 'serif',
  fontSize: 'medium',
  lineHeight: 'normal',
  letterSpacing: 'normal',
};

export const EDITOR_DISPLAY_STORAGE_KEY = 'oryzae-editor-display';

function isFontFamily(value: unknown): value is EditorFontFamily {
  return value === 'serif' || value === 'sans';
}
function isScale(value: unknown): value is EditorScale {
  return value === 'small' || value === 'medium' || value === 'large';
}
function isSpacing(value: unknown): value is EditorSpacing {
  return value === 'tight' || value === 'normal' || value === 'wide';
}

/** 保存値を読む。壊れていれば既定に落とす（項目ごとに）。 */
export function parseEditorDisplay(raw: string | null): EditorDisplay {
  if (!raw) return DEFAULT_EDITOR_DISPLAY;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return DEFAULT_EDITOR_DISPLAY;
    const record: Record<string, unknown> = { ...value };
    return {
      fontFamily: isFontFamily(record.fontFamily)
        ? record.fontFamily
        : DEFAULT_EDITOR_DISPLAY.fontFamily,
      fontSize: isScale(record.fontSize) ? record.fontSize : DEFAULT_EDITOR_DISPLAY.fontSize,
      lineHeight: isSpacing(record.lineHeight)
        ? record.lineHeight
        : DEFAULT_EDITOR_DISPLAY.lineHeight,
      letterSpacing: isSpacing(record.letterSpacing)
        ? record.letterSpacing
        : DEFAULT_EDITOR_DISPLAY.letterSpacing,
    };
  } catch {
    return DEFAULT_EDITOR_DISPLAY;
  }
}

/**
 * 本文の見た目の設定。localStorage に 1 つの JSON で持つ。
 *
 * PC の `useEditorSettings`（px の文字サイズ・行間を別々の鍵で持つ）とは別。段（小・中・大）で
 * 持てば端末をまたいで同じ設定が意味を持つ。PC を寄せるのは作業指示 B6 の続き。
 * SSR とハイドレーションで値が食い違わないよう、保存値は effect で読む。
 */
export function useEditorDisplay(): [EditorDisplay, (patch: Partial<EditorDisplay>) => void] {
  const [display, setDisplay] = useState<EditorDisplay>(DEFAULT_EDITOR_DISPLAY);

  useEffect(() => {
    try {
      setDisplay(parseEditorDisplay(window.localStorage.getItem(EDITOR_DISPLAY_STORAGE_KEY)));
    } catch {
      // 読めなければ既定のまま。
    }
  }, []);

  const update = useCallback((patch: Partial<EditorDisplay>) => {
    setDisplay((previous) => {
      const next = { ...previous, ...patch };
      try {
        window.localStorage.setItem(EDITOR_DISPLAY_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // 保存できなくても画面には効かせる。
      }
      return next;
    });
  }, []);

  return [display, update];
}

/** SP の本文に効かせる値。指の距離で読む画面の段。 */
export const SP_EDITOR_TYPOGRAPHY = {
  fontSize: { small: 15, medium: 17, large: 20 },
  lineHeight: { tight: 1.6, normal: 1.9, wide: 2.2 },
  letterSpacing: { tight: '0', normal: '0.02em', wide: '0.06em' },
  fontFamily: {
    serif: "'Noto Serif JP', serif",
    sans: "'Noto Sans JP', 'Inter', sans-serif",
  },
} as const;
