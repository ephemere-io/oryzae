'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiClient } from '@/lib/api';
import { readBooleanField, readJson, readStringField } from '@/lib/json';

interface UserMeData {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  /** 初回のヘルプを閉じたことがあるか（旧オンボーディングの旗をそのまま使っている）。 */
  onboardingCompleted: boolean;
  /** 一度でも漬け込んだことがあるか。ヘルプの五歩 ④「瓶に漬けて待つ」の旗 (Issue #316 由来) */
  hasPickled: boolean;
  /** 一度でもエントリに問いを紐付けたことがあるか。ヘルプの五歩 ③「問いを紐づける」の旗 (Issue #316 由来) */
  hasLinkedQuestion: boolean;
  /**
   * 問いを 1 件でも立てたことがあるか（アーカイブ済み含む）。
   * ヘルプの五歩 ①「問いを立てる」が済んだかの旗。
   */
  hasQuestion: boolean;
  /** エントリを 1 件でも書いたことがあるか。ヘルプの五歩 ②「エントリーを書く」の旗。 */
  hasEntry: boolean;
  /**
   * 手紙を 1 通でも読んだことがあるか。ヘルプの五歩 ⑤「手紙を読む」の旗。
   * 既読はサーバに残していないので、サーバの実体は「読める手紙（完了した発酵）があるか」。
   * 開いた瞬間は `lib/activity` の 'read' 合図が補う。
   */
  hasReadLetter: boolean;
}

/**
 * `/api/v1/users/me` の正規化。id / nickname が無ければ「取れなかった」として null。
 * 表示補助のフラグは既定値へ倒す（欠けていても画面は出せる）。
 */
function normalizeUserMe(input: unknown): UserMeData | null {
  const id = readStringField(input, 'id');
  const nickname = readStringField(input, 'nickname');
  if (id === null || nickname === null) return null;
  return {
    id,
    nickname,
    avatarUrl: readStringField(input, 'avatarUrl'),
    onboardingCompleted: readBooleanField(input, 'onboardingCompleted', false),
    hasPickled: readBooleanField(input, 'hasPickled', false),
    hasLinkedQuestion: readBooleanField(input, 'hasLinkedQuestion', false),
    hasQuestion: readBooleanField(input, 'hasQuestion', false),
    hasEntry: readBooleanField(input, 'hasEntry', false),
    hasReadLetter: readBooleanField(input, 'hasReadLetter', false),
  };
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
 * `useHelpFirstVisit`（ヘルプの初回判定）も同じエンドポイントを叩くが、用途と
 * ライフサイクルが異なるためフックを分けている (あちらは app/(protected)/layout の
 * HelpProvider、これは entries feature 内で消費)。
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
    const next = normalizeUserMe(await readJson(res));
    // 形が違う応答では **既存の data を保持したまま** null を返す。この hook は
    // エラー状態を持たず、返り値はナッジ表示の判定にしか使われないので、
    // 壊れた応答で上書きするより直前の正しい値を残すほうが害が小さい。
    if (!next) return null;
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
