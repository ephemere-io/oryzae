'use client';

import { useEffect, useRef } from 'react';
import type { EntryLocalCopy } from '../types';

/**
 * 書いている内容の**端末の写し**（オフラインの保険）。
 *
 * 自動保存はネットが無いと失敗する。失敗したまま画面を閉じると書いたものが消える。
 * ここでは入力のたびに localStorage へ写しを置き、サーバーが同じ内容を保存できたら消す。
 * 開いたとき、写しがサーバーの内容より新しく中身が違えば、写しから始める（`readEntryLocalCopy`）。
 *
 * 新規エントリ（id が無い）は `useEntryDraft` が同じ役目を持つので、ここは **id のあるエントリ**だけ。
 */

const PREFIX = 'oryzae:entry-copy:';
const WRITE_DEBOUNCE_MS = 300;

function key(entryId: string): string {
  return `${PREFIX}${entryId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isEntryLocalCopy(value: unknown): value is EntryLocalCopy {
  if (!isRecord(value)) return false;
  return (
    typeof value.entryId === 'string' &&
    typeof value.content === 'string' &&
    Array.isArray(value.mediaUrls) &&
    value.mediaUrls.every((item) => typeof item === 'string') &&
    Array.isArray(value.inlinePaths) &&
    value.inlinePaths.every((item) => typeof item === 'string') &&
    typeof value.updatedAt === 'number'
  );
}

export function readEntryLocalCopy(entryId: string): EntryLocalCopy | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key(entryId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isEntryLocalCopy(parsed)) {
      window.localStorage.removeItem(key(entryId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearEntryLocalCopy(entryId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key(entryId));
  } catch {
    // storage 不可は無視
  }
}

function writeEntryLocalCopy(copy: EntryLocalCopy): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key(copy.entryId), JSON.stringify(copy));
  } catch {
    // 容量超過・プライベートモードは無視
  }
}

/**
 * サーバーの内容（`savedContent`）と違う間だけ写しを置き、同じになったら消す。
 * `entryId` が無い間は何もしない。
 */
export function useEntryLocalCopy({
  entryId,
  content,
  mediaUrls,
  inlinePaths,
  savedContent,
}: {
  entryId: string | undefined;
  content: string;
  mediaUrls: readonly string[];
  inlinePaths: readonly string[];
  /** サーバーが持っている（と分かっている）内容。 */
  savedContent: string;
}): void {
  const latestRef = useRef({ entryId, content, mediaUrls, inlinePaths, savedContent });
  latestRef.current = { entryId, content, mediaUrls, inlinePaths, savedContent };

  useEffect(() => {
    if (!entryId) return;
    if (content === savedContent) {
      clearEntryLocalCopy(entryId);
      return;
    }
    const timer = setTimeout(() => {
      writeEntryLocalCopy({
        entryId,
        content,
        mediaUrls: [...mediaUrls],
        inlinePaths: [...inlinePaths],
        updatedAt: Date.now(),
      });
    }, WRITE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [entryId, content, mediaUrls, inlinePaths, savedContent]);

  // 画面を離れるときは待たずに写す（debounce の途中で消えると最後の入力が残らない）。
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const flush = () => {
      const latest = latestRef.current;
      if (!latest.entryId || latest.content === latest.savedContent) return;
      writeEntryLocalCopy({
        entryId: latest.entryId,
        content: latest.content,
        mediaUrls: [...latest.mediaUrls],
        inlinePaths: [...latest.inlinePaths],
        updatedAt: Date.now(),
      });
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);
}
