'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeSummaries } from '@/features/shared/fermentation/normalize';
import type {
  FermentationSummary,
  InboxLetter,
  InboxQuestion,
} from '@/features/shared/fermentation/types';
import type { ApiClient } from '@/lib/api';

/** `res.json()` は型なし。配列でないレスポンスで落ちないよう要素ごとに形を確かめる。 */
function parseInboxQuestions(input: unknown): InboxQuestion[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((row): InboxQuestion[] => {
    if (typeof row !== 'object' || row === null) return [];
    const r: Record<string, unknown> = row;
    if (typeof r.id !== 'string') return [];
    return [{ id: r.id, currentText: typeof r.currentText === 'string' ? r.currentText : null }];
  });
}

function byCreatedAtDesc(a: { createdAt: string }, b: { createdAt: string }): number {
  return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
}

/**
 * SP の受信箱: 完了した発酵を「届いた手紙」として問いごとに最新1件、新着順に返す。
 * Issue #363 perf: 問い一覧と全発酵をそれぞれ1回ずつ取得（並行）して集約する。
 * 旧来は /questions → 問いごとに /fermentations の N+1 だった。手紙本文は重いので一覧では
 * 取らず、開いた時に useFermentationDetail で取得。
 *
 * Issue #447: 既読/未読はここでは決めない。取得時点でスナップショットしていたため、開いた
 * 手紙が一覧上で未読のまま残っていた。判定は use-unread-letters に一本化する。
 * あわせて一覧の基準を発酵側に置く。問い一覧に載らない問い（アーカイブ済み等）の手紙を
 * 落としていたため、ナビのバッジには数えられるのに開けない手紙が生まれていた。
 */
export function useFermentationInbox(api: ApiClient | null, authLoading: boolean) {
  const [letters, setLetters] = useState<InboxLetter[]>([]);
  const [loading, setLoading] = useState(true);
  // 取れなかったのか、本当に 1 通も無いのか。書斎はこれを見て、前回の絵を出すか決める。
  const [error, setError] = useState(false);

  // アンマウント後に setState しないためのフラグ。fetchInbox は refetch としても公開して
  // いるので、effect の cancelled ローカル変数ではなく ref で持つ。
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const fetchInbox = useCallback(async () => {
    if (!api || authLoading) return;
    setLoading(true);
    setError(false);
    try {
      const [qRes, fRes] = await Promise.all([
        api.fetch('/api/v1/questions'),
        api.fetch('/api/v1/fermentations'),
      ]);
      if (!mounted.current) return;
      if (!qRes.ok || !fRes.ok) {
        setError(true);
        return;
      }

      const questions = parseInboxQuestions(await qRes.json());
      const completed = normalizeSummaries(await fRes.json()).filter(
        (f) => f.status === 'completed',
      );

      // 完了発酵を問いごとに最新1件へ畳む。
      const latestByQuestion = new Map<string, FermentationSummary>();
      for (const f of completed) {
        const cur = latestByQuestion.get(f.questionId);
        if (!cur || f.createdAt > cur.createdAt) latestByQuestion.set(f.questionId, f);
      }

      const textByQuestionId = new Map(questions.map((q) => [q.id, q.currentText]));
      const inbox = [...latestByQuestion.values()].map(
        (latest): InboxLetter => ({
          questionId: latest.questionId,
          questionText: textByQuestionId.get(latest.questionId) ?? null,
          fermentationId: latest.id,
          createdAt: latest.createdAt,
        }),
      );

      if (!mounted.current) return;
      setLetters(inbox.sort(byCreatedAtDesc));
    } catch {
      // 受信箱が取れなくても瓶は「まだ手紙は届いていません」で成立する。catch が無いと
      // useEffect 内の未処理 rejection になり、loading も true に張り付いていた。
      if (mounted.current) setError(true);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [api, authLoading]);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  return { letters, loading, error, refetch: fetchInbox };
}
