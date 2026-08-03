'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FermentationSummary, InboxLetter } from '@/features/shared/fermentation/types';
import type { ApiClient } from '@/lib/api';

interface QuestionLite {
  id: string;
  currentText: string | null;
}

// unread-context と同じ localStorage キーを共有（瓶を見た時刻）
const LAST_SEEN_KEY = 'oryzae_jar_last_seen_at';

function getLastSeenAt(): string {
  if (typeof window === 'undefined') return new Date(0).toISOString();
  return localStorage.getItem(LAST_SEEN_KEY) ?? new Date(0).toISOString();
}

function byCreatedAtDesc(a: { createdAt: string }, b: { createdAt: string }): number {
  return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
}

/**
 * SP の受信箱: 完了した発酵を「届いた手紙」として問いごとに最新1件、新着順に返す。
 * Issue #363 perf: 問い一覧と全発酵をそれぞれ1回ずつ取得（並行）して集約する。
 * 旧来は /questions → 問いごとに /fermentations の N+1 だった。手紙本文は重いので一覧では
 * 取らず、開いた時に useFermentationDetail で取得。
 */
export function useFermentationInbox(api: ApiClient | null, authLoading: boolean) {
  const [letters, setLetters] = useState<InboxLetter[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInbox = useCallback(async () => {
    if (!api || authLoading) return;
    setLoading(true);
    const [qRes, fRes] = await Promise.all([
      api.fetch('/api/v1/questions'),
      api.fetch('/api/v1/fermentations'),
    ]);
    if (!qRes.ok || !fRes.ok) {
      setLoading(false);
      return;
    }
    const questions: QuestionLite[] = await qRes.json();
    const fermentations: FermentationSummary[] = await fRes.json();
    const lastSeen = getLastSeenAt();

    // 完了発酵を問いごとに最新1件へ畳む。
    const latestByQuestion = new Map<string, FermentationSummary>();
    for (const f of fermentations) {
      if (f.status !== 'completed') continue;
      const cur = latestByQuestion.get(f.questionId);
      if (!cur || f.createdAt > cur.createdAt) latestByQuestion.set(f.questionId, f);
    }

    const inbox = questions.flatMap((q): InboxLetter[] => {
      const latest = latestByQuestion.get(q.id);
      if (!latest) return [];
      return [
        {
          questionId: q.id,
          questionText: q.currentText,
          fermentationId: latest.id,
          createdAt: latest.createdAt,
          unread: latest.createdAt > lastSeen,
        },
      ];
    });

    setLetters(inbox.sort(byCreatedAtDesc));
    setLoading(false);
  }, [api, authLoading]);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  return { letters, loading, refetch: fetchInbox };
}
