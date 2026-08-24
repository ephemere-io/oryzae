'use client';

import { useEffect, useRef } from 'react';

interface AutosaveOptions {
  mediaUrls?: string[];
}

interface UseAutosaveEntryParams {
  title: string;
  body: string;
  entryId: string | undefined;
  save: (content: string, entryId?: string, options?: AutosaveOptions) => Promise<string | null>;
  onSaved?: (entryId: string, savedBody: string) => void;
  enabled: boolean;
  debounceMs?: number;
  minDeltaChars?: number;
  /**
   * エントリに添えた写真。渡すと自動保存のたびに一緒に送られる。
   * 保存の起動条件は本文の変化のままにしたいので、依存配列には入れず ref 経由で
   * 最新値を読む（写真を足しただけで保存が走るのは呼び出し側が明示的に行う）。
   */
  mediaUrls?: string[];
}

const DEFAULT_DEBOUNCE_MS = 2000;
const DEFAULT_MIN_DELTA_CHARS = 10;

export function useAutosaveEntry({
  title,
  body,
  entryId,
  save,
  onSaved,
  enabled,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  minDeltaChars = DEFAULT_MIN_DELTA_CHARS,
  mediaUrls,
}: UseAutosaveEntryParams) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedBodyRef = useRef<string>(body);
  const prevEntryIdRef = useRef<string | undefined>(entryId);
  const mediaUrlsRef = useRef<string[] | undefined>(mediaUrls);
  mediaUrlsRef.current = mediaUrls;

  // Re-baseline when the entry id transitions (e.g. autosave creates the entry)
  if (prevEntryIdRef.current !== entryId) {
    prevEntryIdRef.current = entryId;
    lastSavedBodyRef.current = body;
  }

  useEffect(() => {
    if (!enabled) return;
    if (!body.trim()) return;
    const delta = Math.abs(body.length - lastSavedBodyRef.current.length);
    if (delta < minDeltaChars) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (!body.trim()) return;
      const currentDelta = Math.abs(body.length - lastSavedBodyRef.current.length);
      if (currentDelta < minDeltaChars) return;

      const finalContent = title.trim() ? `${title.trim()}\n${body}` : body;
      const currentMedia = mediaUrlsRef.current;
      const savedId = await save(
        finalContent,
        entryId,
        currentMedia === undefined ? undefined : { mediaUrls: currentMedia },
      );
      if (savedId) {
        lastSavedBodyRef.current = body;
        onSaved?.(savedId, body);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [body, title, entryId, enabled, save, onSaved, debounceMs, minDeltaChars]);
}
