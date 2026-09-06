'use client';

import { useCallback } from 'react';
import type { SnippetOcrResult } from '@/features/shared/board/types';
import type { ApiClient } from '@/lib/api';

function parseText(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('text' in data)) return null;
  const { text } = data;
  return typeof text === 'string' ? text : null;
}

/**
 * 画像1枚をサーバーに送り、写っている文字を読み取って返す（端末非依存）。
 *
 * ここではスニペットを作らない。読み取り結果を下書きとして返すだけで、
 * 確認・編集してから作るのは呼び出し側（→ useCreateSnippet）。
 */
export function useOcrSnippetText(api: ApiClient | null) {
  return useCallback(
    async (file: File): Promise<SnippetOcrResult> => {
      if (!api) return { status: 'failed' };

      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await api.fetch('/api/v1/board/snippets/ocr', {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) return { status: 'failed' };

        const text = parseText(await res.json());
        if (text === null) return { status: 'failed' };
        return text.trim().length === 0 ? { status: 'empty' } : { status: 'ok', text };
      } catch {
        // 通信・パースの失敗。呼び出し元はダイアログ内の async ハンドラで、投げても
        // 誰も受け取らない（未処理 rejection になり読み取り中の表示が戻らない）ので
        // ここで止め、失敗として値で返す。
        return { status: 'failed' };
      }
    },
    [api],
  );
}
