'use client';

import { useMemo } from 'react';
import { useQuestions } from '@/features/shared/questions/hooks/use-questions';
import type { FilterableQuestion } from '@/features/shared/questions/types';
import type { ApiClient } from '@/lib/api';

/**
 * エントリ一覧の「問いで絞り込む」選択肢を返す（端末非依存）。
 *
 * アーカイブ済みと本文が空の問いを除いた表示可能なものだけを返す。
 * Issue #490: この整形は `app/(protected)/entries/page.tsx` にあり、page が
 * ドメイン加工を持っていた。PC/SP 双方の一覧が同じ選択肢を使うのでここへ移した
 * （1回の取得を両者で共有し、二重 fetch も避ける）。
 */
export function useFilterableQuestions(api: ApiClient | null): FilterableQuestion[] {
  const { questions } = useQuestions(api);

  return useMemo(
    () =>
      questions.flatMap((q) => {
        if (q.isArchived) return [];
        const text = q.currentText;
        if (text === null || text.length === 0) return [];
        return [{ id: q.id, currentText: text }];
      }),
    [questions],
  );
}
