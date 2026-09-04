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
  // 「まだ取れていない」と「0 件」は見た目が別（SP の瓶は前者で枠を出し、後者で
  // 「問いがまだありません」を出す）。取れていないのに 0 件の文言を出すと、
  // 一瞬「問いを消してしまった」ように見える。
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!api) return;
    try {
      const res = await api.fetch('/api/v1/questions');
      if (res.ok) setQuestions(await res.json());
    } catch {
      // 取れないだけ。前回の内容を保つ（瓶を空にしない）。ここで投げると effect からの
      // 呼び出しが unhandled rejection になるので、握って loading だけ下ろす。
    }
    setLoading(false);
  }, [api]);

  useEffect(() => {
    if (authLoading) return;
    refetch();
  }, [authLoading, refetch]);

  return { questions, loading, refetch };
}
