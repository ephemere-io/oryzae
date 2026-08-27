'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ApiClient } from '@/lib/api';

const STORAGE_KEY = 'oryzae_jar_last_seen_at';

/**
 * 未読件数を数える。
 *
 * `res.json()` は型なし。以前は `const data: FermentationSummary[] = await res.json()` と
 * 名乗らせて直後に `.filter` していたため、配列でないレスポンス（エラーエンベロープ等）で
 * TypeError になっていた。未読バッジは**全画面のナビ**に出るので、影響範囲が最も広い。
 * ここは表示できなければ 0 でよいので、要素ごとに形を確かめて数えるだけにする。
 */
function countUnread(input: unknown, lastSeen: string): number {
  if (!Array.isArray(input)) return 0;
  return input.filter((row) => {
    if (typeof row !== 'object' || row === null) return false;
    const r: Record<string, unknown> = row;
    return r.status === 'completed' && typeof r.createdAt === 'string' && r.createdAt > lastSeen;
  }).length;
}

interface UnreadContextValue {
  unreadCount: number;
  markSeen: () => void;
}

const UnreadContext = createContext<UnreadContextValue>({
  unreadCount: 0,
  markSeen: () => {},
});

export function useUnread() {
  return useContext(UnreadContext);
}

function getLastSeenAt(): string {
  if (typeof window === 'undefined') return new Date().toISOString();
  return localStorage.getItem(STORAGE_KEY) ?? new Date(0).toISOString();
}

export function UnreadProvider({
  api,
  authLoading,
  children,
}: {
  api: ApiClient | null;
  authLoading: boolean;
  children: React.ReactNode;
}) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!api || authLoading) return;

    let cancelled = false;

    async function check() {
      try {
        // Issue #363 perf: 全発酵をバルク取得（questionId 省略）して未読を数える。
        // 旧来は /questions → 問いごとに /fermentations の N+1 だった。
        const res = await api!.fetch('/api/v1/fermentations');
        if (!res.ok || cancelled) return;
        const data: unknown = await res.json();
        if (cancelled) return;
        setUnreadCount(countUnread(data, getLastSeenAt()));
      } catch {
        // バッジは補助表示。取れなければ 0 のままでよく、ナビ全体を巻き込まない
        // （catch が無いと useEffect 内の未処理 rejection になっていた）。
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [api, authLoading]);

  const markSeen = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    }
    setUnreadCount(0);
  }, []);

  return (
    <UnreadContext.Provider value={{ unreadCount, markSeen }}>{children}</UnreadContext.Provider>
  );
}
