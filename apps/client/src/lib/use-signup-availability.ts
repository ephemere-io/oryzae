'use client';

import { useEffect, useState } from 'react';

/**
 * Research Preview のサインアップ枠状況。サーバーの `SignupAvailability` と同形。
 * 内部 hook 専用なので export しない（knip で unused export 検出されないため）。
 */
interface SignupAvailability {
  limit: number;
  used: number;
  remaining: number;
  capacityReached: boolean;
}

/**
 * `GET /api/v1/auth/signup/availability` をマウント時にフェッチして
 * 残り登録枠を取得する（Issue #300）。認証不要。
 *
 * - `loading`: 初回フェッチ中
 * - `error`: フェッチ失敗時のメッセージ（i18n はせず英語の生メッセージを返す）
 * - `availability`: 取得済みなら `SignupAvailability`、未取得なら null
 */
export function useSignupAvailability() {
  const [availability, setAvailability] = useState<SignupAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/v1/auth/signup/availability');
        if (!res.ok) {
          if (!cancelled) {
            setError(`Failed to load signup availability (${res.status})`);
            setLoading(false);
          }
          return;
        }
        const data = (await res.json()) as SignupAvailability;
        if (!cancelled) {
          setAvailability(data);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load signup availability');
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { availability, loading, error };
}
