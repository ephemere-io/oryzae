'use client';

import { useCallback, useRef } from 'react';
import type { ApiClient } from '@/lib/api';

interface JarPositionItem {
  id: string;
  jarX: number;
  jarY: number;
}

export interface JarLayout {
  questions: JarPositionItem[];
  keywords: JarPositionItem[];
  snippets: JarPositionItem[];
  letters: JarPositionItem[];
}

const DEBOUNCE_MS = 500;

/**
 * Debounced batch saver for the Jar view layout. Each call replaces any pending save with a fresh
 * 500ms timer so rapid drags coalesce into a single PUT — same pattern as `useBoardSave`.
 */
export function useJarLayoutSave(api: ApiClient | null) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<JarLayout | null>(null);

  const saveLayout = useCallback(
    (layout: JarLayout) => {
      if (!api) return;
      pendingRef.current = layout;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        const payload = pendingRef.current;
        if (!payload) return;
        pendingRef.current = null;
        await api.fetch('/api/v1/jar/layout', {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      }, DEBOUNCE_MS);
    },
    [api],
  );

  return { saveLayout };
}
