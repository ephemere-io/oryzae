'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ACTIVITY_EVENT } from '@/lib/activity';
import type { ApiClient } from '@/lib/api';
import { readBooleanField, readJson } from '@/lib/json';
import type { HelpProgress } from '../types';

interface UseHelpProgressResult {
  /** 初めての人か。確かめる前は null。 */
  firstVisit: boolean | null;
  /** 三歩の進み具合。確かめる前は null。 */
  progress: HelpProgress | null;
  /** 「見た」と記録する。以後は自動で開かない。 */
  markSeen: () => Promise<void>;
  /** 取り直す（何かを成し遂げた合図が来たとき）。 */
  refresh: () => Promise<void>;
}

/**
 * 初めての人にだけヘルプを自動で開くための門と、三歩の進み具合。
 *
 * どちらも `/api/v1/users/me` の旗から読む。`onboardingCompleted` は旧オンボーディングが
 * 立てていた旗（名前は残っているが、意味は「初回のヘルプを閉じたことがある」）。三歩は
 * `hasQuestion`（問いを立てた）・`hasLinkedQuestion`（問いを結んで書いた）・`hasPickled`
 * （漬け込んだ）— どれも「一度でもやったか」で、進み具合を別に憶えない。データがそのまま
 * 進み具合なので、消したり戻したりしても嘘にならない。
 *
 * 何かを成し遂げた合図（`lib/activity`）を聞いて取り直す。questions / entries の hook が
 * 出す window のイベントで、ここは相手のドメインを知らない。
 */
export function useHelpProgress(api: ApiClient | null): UseHelpProgressResult {
  const [firstVisit, setFirstVisit] = useState<boolean | null>(null);
  const [progress, setProgress] = useState<HelpProgress | null>(null);
  const apiRef = useRef(api);
  apiRef.current = api;

  // 確かめられなければ「初めてではない」に倒す（勝手に開かない側が安全）。失敗は投げない —
  // ヘルプは本筋ではなく、unhandled rejection を Sentry に積む価値も無い。
  const load = useCallback(async (): Promise<void> => {
    const client = apiRef.current;
    if (!client) return;
    try {
      const res = await client.fetch('/api/v1/users/me');
      if (!res.ok) {
        setFirstVisit(false);
        return;
      }
      const json = await readJson(res);
      setFirstVisit(!readBooleanField(json, 'onboardingCompleted', true));
      setProgress({
        question: readBooleanField(json, 'hasQuestion', false),
        write: readBooleanField(json, 'hasLinkedQuestion', false),
        pickle: readBooleanField(json, 'hasPickled', false),
      });
    } catch {
      setFirstVisit(false);
    }
  }, []);

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    // 取り消されたあとの結果は捨てる（古い api の返事で新しい状態を上書きしない）。
    void load().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [api, load]);

  // 何かを成し遂げたら取り直す。合図は種類だけで、どれが変わったかは旗を読み直せば分かる。
  useEffect(() => {
    if (!api) return;
    const onActivity = () => {
      void load();
    };
    window.addEventListener(ACTIVITY_EVENT, onActivity);
    return () => window.removeEventListener(ACTIVITY_EVENT, onActivity);
  }, [api, load]);

  // 「始めてみよう」と初めての × の両方から呼ばれるので、送るのは一度だけ。
  const marked = useRef(false);
  const markSeen = useCallback(async () => {
    setFirstVisit(false);
    const client = apiRef.current;
    if (!client || marked.current) return;
    marked.current = true;
    try {
      await client.fetch('/api/v1/users/me/onboarding', {
        method: 'PATCH',
        body: JSON.stringify({ completed: true }),
      });
    } catch {
      // 次の読み込みでもう一度「初めて」扱いになるだけ。
    }
  }, []);

  return { firstVisit, progress, markSeen, refresh: load };
}
