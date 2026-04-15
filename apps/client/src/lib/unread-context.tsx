'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ApiClient } from '@/lib/api';

const STORAGE_KEY = 'oryzae_jar_last_seen_at';

interface FermentationSummary {
  id: string;
  questionId: string;
  status: string;
  createdAt: string;
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
      // First get active questions
      const qRes = await api!.fetch('/api/v1/questions');
      if (!qRes.ok || cancelled) return;
      const questions: { id: string }[] = await qRes.json();
      if (questions.length === 0) return;

      const lastSeen = getLastSeenAt();
      let count = 0;

      const promises = questions.map(async (q) => {
        const res = await api!.fetch(`/api/v1/fermentations?questionId=${q.id}`);
        if (!res.ok) return;
        const data: FermentationSummary[] = await res.json();
        for (const r of data) {
          if (r.status === 'completed' && r.createdAt > lastSeen) {
            count++;
          }
        }
      });

      await Promise.all(promises);
      if (!cancelled) setUnreadCount(count);
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
