'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ApiClient } from '@/lib/api';

/** 瓶に届いた手紙（＝完了した発酵）の受信箱1件。 */
export interface InboxLetter {
  questionId: string;
  questionText: string | null;
  fermentationId: string;
  createdAt: string;
  unread: boolean;
}

interface QuestionLite {
  id: string;
  currentText: string | null;
}

interface FermentationSummary {
  id: string;
  questionId: string;
  status: string;
  createdAt: string;
}

interface FermentationDetailLetter {
  letter: { bodyText: string } | null;
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
 * SP の受信箱: 全問いを走査し、完了した発酵があるものを「届いた手紙」として新着順に返す。
 * バルクエンドポイントが無いため unread-context と同じ N+1（questions → per-question
 * fermentations）で集約する。手紙本文は重いので一覧では取らず、開いた時に useFermentationLetter で取得。
 */
export function useFermentationInbox(api: ApiClient | null, authLoading: boolean) {
  const [letters, setLetters] = useState<InboxLetter[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInbox = useCallback(async () => {
    if (!api || authLoading) return;
    setLoading(true);
    const qRes = await api.fetch('/api/v1/questions');
    if (!qRes.ok) {
      setLoading(false);
      return;
    }
    const questions: QuestionLite[] = await qRes.json();
    const lastSeen = getLastSeenAt();

    const perQuestion = await Promise.all(
      questions.map(async (q): Promise<InboxLetter | null> => {
        const res = await api.fetch(`/api/v1/fermentations?questionId=${q.id}`);
        if (!res.ok) return null;
        const data: FermentationSummary[] = await res.json();
        const latest = data.filter((r) => r.status === 'completed').sort(byCreatedAtDesc)[0];
        if (!latest) return null;
        return {
          questionId: q.id,
          questionText: q.currentText,
          fermentationId: latest.id,
          createdAt: latest.createdAt,
          unread: latest.createdAt > lastSeen,
        };
      }),
    );

    setLetters(perQuestion.filter((x): x is InboxLetter => x !== null).sort(byCreatedAtDesc));
    setLoading(false);
  }, [api, authLoading]);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  return { letters, loading, refetch: fetchInbox };
}

/** 手紙本文を取得する。開いた発酵の詳細から letter.bodyText を読む。 */
export function useFermentationLetter(api: ApiClient | null, fermentationId: string | null) {
  const [bodyText, setBodyText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!api || !fermentationId) {
      setBodyText(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api.fetch(`/api/v1/fermentations/${fermentationId}`).then(async (res) => {
      if (cancelled) return;
      if (res.ok) {
        const detail: FermentationDetailLetter = await res.json();
        setBodyText(detail.letter?.bodyText ?? null);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [api, fermentationId]);

  return { bodyText, loading };
}
