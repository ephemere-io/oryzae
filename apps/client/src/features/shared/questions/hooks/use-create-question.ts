'use client';

import { useCallback } from 'react';
import type { ApiClient } from '@/lib/api';

/**
 * 問いを1件作って **その id を返す**（端末非依存）。
 *
 * `useQuestions` の `createQuestion` は一覧の再取得を伴い id を返さないため、
 * 「作った問いに即エントリを紐づける」用途（PC エディタの漬け込みフロー）には使えない。
 * Issue #490: そのため entry-editor が POST を直叩きしていたのを、ここへ切り出した。
 * 一覧を持たないので、エディタでマウントしても余計な GET は走らない。
 */
export function useCreateQuestion(api: ApiClient | null) {
  return useCallback(
    async (text: string): Promise<string | null> => {
      if (!api || !text.trim()) return null;
      const res = await api.fetch('/api/v1/questions', {
        method: 'POST',
        body: JSON.stringify({ string: text }),
      });
      if (!res.ok) return null;
      const data: unknown = await res.json();
      if (typeof data !== 'object' || data === null || !('id' in data)) return null;
      return typeof data.id === 'string' ? data.id : null;
    },
    [api],
  );
}
