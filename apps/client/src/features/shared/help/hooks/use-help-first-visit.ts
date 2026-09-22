'use client';

import { useCallback, useEffect, useState } from 'react';
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

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    (async () => {
      const res = await api.fetch('/api/v1/users/me');
      if (cancelled || !res.ok) return;
      const completed = readBooleanField(await readJson(res), 'onboardingCompleted', true);
      if (cancelled) return;
      setFirstVisit(!completed);
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const markSeen = useCallback(async () => {
    setFirstVisit(false);
    if (!api) return;
    await api.fetch('/api/v1/users/me/onboarding', {
      method: 'PATCH',
      body: JSON.stringify({ completed: true }),
    });
  }, [api]);

  return { firstVisit, markSeen };
}
