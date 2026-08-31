'use client';

import { useCallback, useEffect, useState } from 'react';
import type { JarQuestion } from '@/features/shared/questions/types';
import type { ApiClient } from '@/lib/api';

/**
 * 瓶ビューに並べるアクティブな問い（座標つき）を取得する（端末非依存）。
 *
 * Issue #490: `app/(protected)/jar/page.tsx` が `/api/v1/questions` を直叩きし、
 * 座標つきの型も page がローカル定義していた。取得と再取得をここに閉じる。
 * 追加・編集・アーカイブの後は `refetch` を呼ぶ（`useQuestions` は
 * `/questions/all` を見るので、瓶が使うアクティブ一覧とは別物）。
 */
export function useJarQuestions(api: ApiClient | null, authLoading: boolean) {
  const [questions, setQuestions] = useState<JarQuestion[]>([]);

  const refetch = useCallback(async () => {
    if (!api) return;
    const res = await api.fetch('/api/v1/questions');
    if (res.ok) setQuestions(await res.json());
  }, [api]);

  useEffect(() => {
    if (authLoading) return;
    refetch();
  }, [authLoading, refetch]);

  return { questions, refetch };
}
