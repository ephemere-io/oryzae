'use client';

import { useCallback } from 'react';
import type { ApiClient } from '@/lib/api';

/**
 * エントリ保存後に fire-and-forget でフェルメンテーション API を呼ぶ。
 * アクティブな問い全てに対して分析をトリガーする。
 */
export function useTriggerFermentation(api: ApiClient | null) {
  const trigger = useCallback(
    async (entryId: string, entryContent: string) => {
      if (!api) return;

      try {
        // 1. ユーザーのアクティブな問いを取得
        const questionsRes = await api.fetch('/api/v1/questions');
        if (!questionsRes.ok) return;

        const questions = (await questionsRes.json()) as {
          id: string;
          currentText: string | null;
        }[];

        // 2. 各問いに対して分析をトリガー（並行実行）
        await Promise.allSettled(
          questions.map((q) =>
            api.fetch('/api/v1/fermentations', {
              method: 'POST',
              body: JSON.stringify({
                entryId,
                questionId: q.id,
                questionText: q.currentText ?? '',
                entryContent,
              }),
            }),
          ),
        );
      } catch {
        // fire-and-forget: エラーは静かに無視
      }
    },
    [api],
  );

  return trigger;
}
