'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiClient } from '@/lib/api';
import { readBooleanField, readJson } from '@/lib/json';

interface UseHelpFirstVisitResult {
  /** 初めての人か。確かめる前は null。 */
  firstVisit: boolean | null;
  /** 「見た」と記録する。以後は自動で開かない。 */
  markSeen: () => Promise<void>;
}

/**
 * 初めての人にだけヘルプを自動で開くための門。
 *
 * サーバーの `onboardingCompleted` をそのまま使う（旧オンボーディングが立てていた旗。
 * 名前は残っているが、意味は「初回のヘルプを閉じたことがある」になった）。
 * エディタのナッジ（Issue #316）もこの旗を見て「初回の案内が済んだ人にだけ出す」ので、
 * 旗を増やさず同じものを使う。
 */
export function useHelpFirstVisit(api: ApiClient | null): UseHelpFirstVisitResult {
  const [firstVisit, setFirstVisit] = useState<boolean | null>(null);

  // 確かめられなければ「初めてではない」に倒す（勝手に開かない側が安全）。失敗は投げない —
  // ヘルプは本筋ではなく、unhandled rejection を Sentry に積む価値も無い。
  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.fetch('/api/v1/users/me');
        if (cancelled) return;
        if (!res.ok) {
          setFirstVisit(false);
          return;
        }
        const completed = readBooleanField(await readJson(res), 'onboardingCompleted', true);
        if (cancelled) return;
        setFirstVisit(!completed);
      } catch {
        if (!cancelled) setFirstVisit(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  // 「始めてみよう」と初めての × の両方から呼ばれるので、送るのは一度だけ。
  const marked = useRef(false);
  const markSeen = useCallback(async () => {
    setFirstVisit(false);
    if (!api || marked.current) return;
    marked.current = true;
    try {
      await api.fetch('/api/v1/users/me/onboarding', {
        method: 'PATCH',
        body: JSON.stringify({ completed: true }),
      });
    } catch {
      // 次の読み込みでもう一度「初めて」扱いになるだけ。
    }
  }, [api]);

  return { firstVisit, markSeen };
}
