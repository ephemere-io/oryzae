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

/** 瓶の発酵が生んだ出力。手紙(letter)・言葉(keywords)・抜粋(snippets)。 */
interface FermentationKeyword {
  id: string;
  keyword: string;
  description: string;
}

interface FermentationSnippet {
  id: string;
  originalText: string;
  sourceDate: string;
}

interface FermentationDetail {
  bodyText: string | null;
  keywords: FermentationKeyword[];
  snippets: FermentationSnippet[];
}

interface RawFermentationDetail {
  letter?: { bodyText?: string } | null;
  keywords?: FermentationKeyword[];
  snippets?: FermentationSnippet[];
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

/**
 * 開いた発酵の詳細（手紙・言葉・抜粋）を取得する。指摘「瓶は手紙以外の出力も
 * 確認できるべき」への対応で、PC 同様 keywords/snippets も読む。
 */
export function useFermentationDetail(api: ApiClient | null, fermentationId: string | null) {
  const [detail, setDetail] = useState<FermentationDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!api || !fermentationId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api.fetch(`/api/v1/fermentations/${fermentationId}`).then(async (res) => {
      if (cancelled) return;
      if (res.ok) {
        const raw: RawFermentationDetail = await res.json();
        setDetail({
          bodyText: raw.letter?.bodyText ?? null,
          keywords: Array.isArray(raw.keywords) ? raw.keywords : [],
          snippets: Array.isArray(raw.snippets) ? raw.snippets : [],
        });
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [api, fermentationId]);

  return { detail, loading };
}
