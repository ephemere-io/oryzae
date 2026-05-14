'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiClient } from '@/lib/api';

interface UserMeData {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  onboardingCompleted: boolean;
  /** 一度でも漬け込んだことがあるか (Issue #316 ガイド表示判定用) */
  hasPickled: boolean;
  /** 一度でもエントリに問いを紐付けたことがあるか (Issue #316 ガイド表示判定用) */
  hasLinkedQuestion: boolean;
}

interface UseUserMeResult {
  data: UserMeData | null;
  loading: boolean;
  /** 保存成功後など、フラグが変わり得るタイミングで呼ぶ */
  refresh: () => Promise<UserMeData | null>;
}

/**
 * Issue #316: EntryEditor の保存成功後ナッジ表示判定に必要な
 * `hasPickled` / `hasLinkedQuestion` を含む user-me を取得する。
 *
 * `useOnboarding` も同じエンドポイントを叩くが、用途とライフサイクルが
 * 異なるためフックを分けている (onboarding は app/(protected)/layout、
 * これは entries feature 内で消費)。
 */
export function useUserMe(api: ApiClient | null): UseUserMeResult {
  const [data, setData] = useState<UserMeData | null>(null);
  const [loading, setLoading] = useState(true);
  const apiRef = useRef(api);
  apiRef.current = api;

  const fetchMe = useCallback(async (): Promise<UserMeData | null> => {
    const client = apiRef.current;
    if (!client) return null;
    const res = await client.fetch('/api/v1/users/me');
    if (!res.ok) return null;
    const next = (await res.json()) as UserMeData;
    setData(next);
    return next;
  }, []);

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    setLoading(true);
    fetchMe().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [api, fetchMe]);

  return { data, loading, refresh: fetchMe };
}
