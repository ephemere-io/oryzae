'use client';

import { type RefObject, useEffect, useState } from 'react';

const FADE_DELAY_MS = 2000;

interface FocusModeOptions {
  enabled: boolean;
  forceVisible: boolean;
  editorRef: RefObject<HTMLElement | null>;
}

/**
 * Hide non-editor UI while the user types, reveal it when the mouse moves.
 * After the mouse stops, remaining input starts a 2s grace period before hiding.
 */
export function useFocusMode({ enabled, forceVisible, editorRef }: FocusModeOptions): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!enabled || forceVisible) {
      setVisible(true);
      return;
    }

    const editor = editorRef.current;
    if (!editor) return;

    let lastMouseMove = 0;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    function clearHideTimer() {
      if (hideTimer !== null) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    }

    function onMouseMove() {
      lastMouseMove = Date.now();
      clearHideTimer();
      setVisible(true);
    }

    function onInput() {
      const elapsed = Date.now() - lastMouseMove;
      if (elapsed >= FADE_DELAY_MS) {
        setVisible(false);
        return;
      }
      clearHideTimer();
      hideTimer = setTimeout(() => {
        setVisible(false);
        hideTimer = null;
      }, FADE_DELAY_MS - elapsed);
    }

    document.addEventListener('mousemove', onMouseMove);
    editor.addEventListener('input', onInput);

    return () => {
      clearHideTimer();
      document.removeEventListener('mousemove', onMouseMove);
      editor.removeEventListener('input', onInput);
    };
  }, [enabled, forceVisible, editorRef]);

  return visible;
}
